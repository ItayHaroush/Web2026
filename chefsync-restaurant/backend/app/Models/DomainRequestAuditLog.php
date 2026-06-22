<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DomainRequestAuditLog extends Model
{
    public $timestamps = false;

    protected $table = 'domain_request_audit_log';

    protected $fillable = [
        'domain_request_id',
        'user_id',
        'action',
        'payload',
        'note',
        'ip_address',
        'created_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'created_at' => 'datetime',
    ];

    public function domainRequest(): BelongsTo
    {
        return $this->belongsTo(DomainRequest::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
