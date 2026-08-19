<?php
declare(strict_types=1);

/**
 * A dependency-free SMTP client. Hostinger shared hosting allows outbound
 * connections on 465 (implicit TLS) and 587 (STARTTLS), which is all this
 * needs — no Composer, no PHPMailer, no `mail()`.
 */
final class Smtp
{
    private $socket = null;
    private string $host;
    private int $port;
    private bool $ssl;
    private ?string $error = null;

    public function __construct(string $host, int $port, bool $ssl)
    {
        $this->host = $host;
        $this->port = $port;
        $this->ssl = $ssl;
    }

    public function error(): ?string
    {
        return $this->error;
    }

    /** @return array{ok:bool,error:?string} */
    public function send(
        string $username,
        string $password,
        string $fromEmail,
        string $fromName,
        string $toEmail,
        string $subject,
        string $html,
        string $text = '',
        string $replyTo = ''
    ): array {
        if (!$this->connect()) {
            return ['ok' => false, 'error' => $this->error];
        }

        try {
            $host = parse_url(Config::siteUrl(), PHP_URL_HOST) ?: 'localhost';

            $this->expect($this->read(), 220);
            $this->command("EHLO {$host}", 250);

            // Port 587 starts plain and upgrades.
            if (!$this->ssl && $this->port === 587) {
                $this->command('STARTTLS', 220);
                $crypto = STREAM_CRYPTO_METHOD_TLS_CLIENT;
                if (!stream_socket_enable_crypto($this->socket, true, $crypto)) {
                    throw new RuntimeException('Could not start TLS.');
                }
                $this->command("EHLO {$host}", 250);
            }

            if ($username !== '') {
                $this->command('AUTH LOGIN', 334);
                $this->command(base64_encode($username), 334);
                $this->command(base64_encode($password), 235);
            }

            $this->command('MAIL FROM:<' . $fromEmail . '>', 250);
            $this->command('RCPT TO:<' . $toEmail . '>', 250);
            $this->command('DATA', 354);

            $this->write($this->message($fromEmail, $fromName, $toEmail, $subject, $html, $text, $replyTo) . "\r\n.");
            $this->expect($this->read(), 250);

            $this->write('QUIT');
            $this->close();

            return ['ok' => true, 'error' => null];
        } catch (Throwable $e) {
            $this->close();
            $this->error = $e->getMessage();
            return ['ok' => false, 'error' => $this->error];
        }
    }

    /** Opens the connection and greets the server, for the "Test SMTP" button. */
    public function verify(string $username, string $password): array
    {
        if (!$this->connect()) {
            return ['ok' => false, 'error' => $this->error];
        }

        try {
            $host = parse_url(Config::siteUrl(), PHP_URL_HOST) ?: 'localhost';
            $this->expect($this->read(), 220);
            $this->command("EHLO {$host}", 250);

            if (!$this->ssl && $this->port === 587) {
                $this->command('STARTTLS', 220);
                stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                $this->command("EHLO {$host}", 250);
            }

            if ($username !== '') {
                $this->command('AUTH LOGIN', 334);
                $this->command(base64_encode($username), 334);
                $this->command(base64_encode($password), 235);
            }

            $this->write('QUIT');
            $this->close();
            return ['ok' => true, 'error' => null];
        } catch (Throwable $e) {
            $this->close();
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function connect(): bool
    {
        $prefix = $this->ssl ? 'ssl://' : '';
        $context = stream_context_create([
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false],
        ]);

        $socket = @stream_socket_client(
            $prefix . $this->host . ':' . $this->port,
            $errorCode,
            $errorMessage,
            20,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if ($socket === false) {
            $this->error = "Could not reach {$this->host}:{$this->port} — {$errorMessage}";
            return false;
        }

        stream_set_timeout($socket, 20);
        $this->socket = $socket;
        return true;
    }

    private function close(): void
    {
        if (is_resource($this->socket)) {
            @fclose($this->socket);
        }
        $this->socket = null;
    }

    private function write(string $line): void
    {
        fwrite($this->socket, $line . "\r\n");
    }

    private function read(): string
    {
        $response = '';
        while (($line = fgets($this->socket, 1024)) !== false) {
            $response .= $line;
            // A space in the fourth character marks the final line of a reply.
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return $response;
    }

    private function command(string $line, int $expected): void
    {
        $this->write($line);
        $this->expect($this->read(), $expected);
    }

    private function expect(string $response, int $expected): void
    {
        $code = (int) substr(trim($response), 0, 3);
        if ($code !== $expected) {
            throw new RuntimeException('SMTP said: ' . trim($response));
        }
    }

    private function message(
        string $fromEmail,
        string $fromName,
        string $toEmail,
        string $subject,
        string $html,
        string $text,
        string $replyTo
    ): string {
        $boundary = 'fc-' . bin2hex(random_bytes(12));
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encodedName = '=?UTF-8?B?' . base64_encode($fromName) . '?=';

        $headers = [
            'Date: ' . date('r'),
            'From: ' . $encodedName . ' <' . $fromEmail . '>',
            'To: <' . $toEmail . '>',
            'Subject: ' . $encodedSubject,
            'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . (parse_url(Config::siteUrl(), PHP_URL_HOST) ?: 'localhost') . '>',
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];

        if ($replyTo !== '') {
            $headers[] = 'Reply-To: <' . $replyTo . '>';
        }

        $plain = $text !== '' ? $text : trim(strip_tags(str_replace(['</p>', '<br>', '<br/>'], "\n", $html)));

        $body = "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($plain)) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html)) . "\r\n"
            . "--{$boundary}--";

        // A line starting with a dot would end the DATA block early.
        $body = preg_replace('/^\./m', '..', $body) ?? $body;

        return implode("\r\n", $headers) . "\r\n\r\n" . $body;
    }
}
