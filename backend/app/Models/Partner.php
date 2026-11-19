<?php

namespace App\Models;

use App\Models\Concerns\HasCreator;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/** Capital owner. Share of profit = capital / total capital of all partners. */
#[Fillable(['name', 'capital', 'note', 'created_by'])]
class Partner extends Model
{
    use HasCreator;

    protected function casts(): array
    {
        return ['capital' => 'decimal:2'];
    }
}
