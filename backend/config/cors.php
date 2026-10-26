<?php

$defaultOrigins = env('APP_ENV', 'production') === 'local'
    ? env('FRONTEND_URL', 'http://localhost:8083')
    : '';
$configuredOrigins = env('CORS_ALLOWED_ORIGINS') ?: $defaultOrigins;

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', $configuredOrigins),
    ))),
    'allowed_origins_patterns' => env('APP_ENV', 'production') === 'local' ? [
        '#^https?://(localhost|127\\.0\\.0\\.1|10\\.\\d+\\.\\d+\\.\\d+|172\\.(1[6-9]|2[0-9]|3[01])\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+):\\d+$#',
    ] : [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
