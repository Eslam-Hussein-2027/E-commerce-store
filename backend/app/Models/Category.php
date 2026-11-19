<?php

namespace App\Models;

use App\Models\Concerns\HasCreator;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'created_by'])]
class Category extends Model
{
    use HasCreator, HasFactory;

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
