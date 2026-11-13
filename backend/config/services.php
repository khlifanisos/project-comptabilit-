<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
    ],

    'brevo' => [
        'key' => env('BREVO_API_KEY'),
    ],

    'sms' => [
        'country_code' => env('SMS_COUNTRY_CODE', '+216'),
    ],

    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_TOKEN'),
        'from' => env('TWILIO_FROM'),
    ],

    'infobip' => [
        'key' => env('INFOBIP_API_KEY'),
        'base_url' => env('INFOBIP_BASE_URL'),
    ],

    'vonage' => [
        'key' => env('VONAGE_API_KEY'),
        'secret' => env('VONAGE_API_SECRET'),
        'from' => env('VONAGE_FROM', 'Comptabilite'),
    ],

    'textbelt' => [
        'key' => env('TEXTBELT_KEY', 'textbelt'),
    ],

];
