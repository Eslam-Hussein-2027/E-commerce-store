<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';
    case OutForDelivery = 'out_for_delivery';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';
    case Returned = 'returned';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'قيد التجهيز',
            self::OutForDelivery => 'خرج للتوصيل',
            self::Delivered => 'تم التسليم',
            self::Cancelled => 'ملغي',
            self::Returned => 'مرتجع',
        };
    }

    /**
     * Allowed next statuses. Cancelled/returned are terminal, so stock
     * can only ever be restored once per order.
     *
     * @return array<int, self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::OutForDelivery, self::Delivered, self::Cancelled],
            self::OutForDelivery => [self::Pending, self::Delivered, self::Cancelled, self::Returned],
            self::Delivered => [self::Returned],
            self::Cancelled, self::Returned => [],
        };
    }

    public function canTransitionTo(self $to): bool
    {
        return in_array($to, $this->allowedTransitions(), true);
    }

    /** Statuses whose stock goes back to the shelf. */
    public function restoresStock(): bool
    {
        return in_array($this, [self::Cancelled, self::Returned], true);
    }

    public static function labels(): array
    {
        return collect(self::cases())->mapWithKeys(fn (self $s) => [$s->value => $s->label()])->all();
    }
}
