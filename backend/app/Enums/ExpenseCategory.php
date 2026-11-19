<?php

namespace App\Enums;

enum ExpenseCategory: string
{
    case Ads = 'ads';
    case Packaging = 'packaging';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Ads => 'إعلانات',
            self::Packaging => 'تغليف',
            self::Other => 'أخرى',
        };
    }
}
