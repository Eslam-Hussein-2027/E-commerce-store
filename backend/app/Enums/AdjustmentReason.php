<?php

namespace App\Enums;

enum AdjustmentReason: string
{
    case Damaged = 'damaged';
    case Lost = 'lost';
    case CountCorrection = 'count_correction';

    public function label(): string
    {
        return match ($this) {
            self::Damaged => 'تالف',
            self::Lost => 'مفقود',
            self::CountCorrection => 'تصحيح جرد',
        };
    }
}
