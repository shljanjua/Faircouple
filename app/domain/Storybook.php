<?php
declare(strict_types=1);

/**
 * The Storybook — written, co-authored chapters of a couple's story. Distinct
 * from the dated "Our Story" timeline: this is prose, guided by evocative
 * prompts, that reads like a book both partners write together.
 */
final class Storybook
{
    /** key => [emoji, title, prompt] — starting points for a chapter. */
    public const PROMPTS = [
        'how_we_met'   => ['👀', 'How we met',            'Set the scene. Where were we, what was said, what did you notice first?'],
        'first_impression' => ['💭', 'My first impression of you', 'Be honest — what did you really think?'],
        'the_moment'   => ['✨', 'The moment I knew',      'When did you realise this was different?'],
        'our_first'    => ['💕', 'Our first…',             'A first that still makes you smile.'],
        'hardest'      => ['🌧️', 'The hardest thing we got through', 'What happened, and how did you come out the other side?'],
        'ordinary_day' => ['🌤️', 'A perfectly ordinary day', 'Not a milestone — just an ordinary day I never want to forget.'],
        'what_you_are' => ['❤️', 'What you are to me',     'Say the thing you don\'t say often enough.'],
        'the_future'   => ['🏡', 'The life I picture with you', 'Where are we, years from now?'],
        'free'         => ['✍️', 'Free chapter',           'Anything you want to write into our story.'],
    ];

    public static function prompt(?string $key): array
    {
        return self::PROMPTS[$key] ?? ['📖', 'A chapter', ''];
    }
}
