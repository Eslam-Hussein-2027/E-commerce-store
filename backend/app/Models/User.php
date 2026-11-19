<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function deliveredOrders(): HasMany
    {
        return $this->hasMany(Order::class, 'delivered_by_user_id');
    }

    public function paidPurchases(): HasMany
    {
        return $this->hasMany(Purchase::class, 'paid_by_user_id');
    }

    public function paidExpenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'paid_by_user_id');
    }

    public function cashHandovers(): HasMany
    {
        return $this->hasMany(CashHandover::class);
    }
}
