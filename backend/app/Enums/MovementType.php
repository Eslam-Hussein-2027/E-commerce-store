<?php

namespace App\Enums;

enum MovementType: string
{
    case In = 'in';
    case Out = 'out';
    case Return = 'return';
    case Adjustment = 'adjustment';

    public function label(): string
    {
        return match ($this) {
            self::In => 'وارد (شراء)',
            self::Out => 'صادر (بيع)',
            self::Return => 'مرتجع للمخزون',
            self::Adjustment => 'تسوية',
        };
    }
}
