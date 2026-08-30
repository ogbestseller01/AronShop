<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Sale extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $primaryKey = 'sale_id';

    protected $fillable = [
        'sale_id',
        'agent_id',
        'product_id',
        'total_amount',
        'payment_method',
        'company_id',              // for loan
        'status',
        'notes',
        'cancellation_reason',      // added
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->sale_id)) {
                $model->sale_id = (string) Str::uuid();
            }
        });
    }

    public function agent()
    {
        return $this->belongsTo(User::class, 'agent_id', 'id');
    }

 

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'product_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'id');
    }

}