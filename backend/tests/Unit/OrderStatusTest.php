<?php

namespace Tests\Unit;

use App\Enums\OrderStatus;
use App\Services\PurchaseService;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** Pure rules — no database or framework needed. */
class OrderStatusTest extends TestCase
{
    #[Test]
    public function cancelled_and_returned_are_terminal_so_stock_is_restored_once(): void
    {
        foreach ([OrderStatus::Cancelled, OrderStatus::Returned] as $terminal) {
            $this->assertSame([], $terminal->allowedTransitions());
            $this->assertTrue($terminal->restoresStock());
        }
    }

    #[Test]
    public function delivered_orders_can_only_be_returned(): void
    {
        $this->assertSame([OrderStatus::Returned], OrderStatus::Delivered->allowedTransitions());
        $this->assertFalse(OrderStatus::Delivered->canTransitionTo(OrderStatus::Cancelled));
    }

    #[Test]
    public function pending_order_cannot_jump_to_returned(): void
    {
        $this->assertFalse(OrderStatus::Pending->canTransitionTo(OrderStatus::Returned));
        $this->assertTrue(OrderStatus::Pending->canTransitionTo(OrderStatus::Delivered));
    }

    #[Test]
    public function every_status_has_an_arabic_label(): void
    {
        $this->assertSame('قيد التجهيز', OrderStatus::Pending->label());
        $this->assertCount(5, OrderStatus::labels());
    }

    #[Test]
    public function weighted_average_handles_rounding_and_empty_stock(): void
    {
        // (3 × 10 + 7 × 13) / 10 = 12.1
        $this->assertSame(12.1, PurchaseService::weightedAverage(3, 10.0, 7, 13.0));
        // Negative stock never happens, but the formula must not divide by a wrong base.
        $this->assertSame(8.0, PurchaseService::weightedAverage(-2, 50.0, 5, 8.0));
    }
}
