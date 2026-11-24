<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

/**
 * Stores profile pictures sent as base64 data URIs.
 *
 * The payload is decoded and checked to be a real, reasonably-sized image
 * before it touches the public directory — previously any bytes were written
 * as-is.
 */
class AvatarStorage
{
    private const MAX_BYTES = 2 * 1024 * 1024;
    private const ALLOWED   = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF, IMAGETYPE_WEBP];
    private const DIR       = 'uploads/avatars';

    /** Saves the image as uploads/avatars/{$basename}.jpg and returns its public URL. */
    public static function store(string $base64, string $basename): string
    {
        $bytes = self::decode($base64);

        $dir = public_path(self::DIR);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $filename = $basename . '.jpg';
        file_put_contents($dir . '/' . $filename, $bytes);

        return config('app.url') . '/' . self::DIR . '/' . $filename;
    }

    /** Deletes a previously stored avatar, given its public URL. */
    public static function delete(?string $url): void
    {
        if (!$url || !str_contains($url, '/' . self::DIR . '/')) {
            return;
        }
        $path = public_path(self::DIR . '/' . basename(parse_url($url, PHP_URL_PATH) ?? ''));
        if (is_file($path)) {
            @unlink($path);
        }
    }

    public static function rename(string $url, string $basename): string
    {
        $from = public_path(self::DIR . '/' . basename(parse_url($url, PHP_URL_PATH) ?? ''));
        $filename = $basename . '.jpg';
        @rename($from, public_path(self::DIR . '/' . $filename));

        return config('app.url') . '/' . self::DIR . '/' . $filename;
    }

    private static function decode(string $base64): string
    {
        $data  = str_contains($base64, ',') ? explode(',', $base64, 2)[1] : $base64;
        $bytes = base64_decode($data, true);

        $info = $bytes !== false && strlen($bytes) <= self::MAX_BYTES
            ? @getimagesizefromstring($bytes)
            : false;

        if ($info === false || !in_array($info[2], self::ALLOWED, true)) {
            throw ValidationException::withMessages([
                'avatar' => 'Image invalide (JPG, PNG, GIF ou WEBP, 2 Mo maximum).',
            ]);
        }

        return $bytes;
    }
}
