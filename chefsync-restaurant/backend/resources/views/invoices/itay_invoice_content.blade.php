{{-- תוכן חשבונית ללא כפילות - משמש להצגה ו-PDF --}}
<div class="itay-invoice-content" style="direction: rtl; font-family: 'Heebo', DejaVu Sans, Arial, sans-serif; font-size: 15px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        @if(!empty($logoPath))
        <img src="{{ $logoPath }}" alt="לוגו" style="height: 50px; max-width: 180px; object-fit: contain;" />
        @elseif(!empty($logoBase64))
        <img src="data:image/png;base64,{{ $logoBase64 }}" alt="לוגו" style="height: 50px; max-width: 180px; object-fit: contain;" />
        @endif
        <div style="text-align: left; flex: 1;">
            <div style="font-size: 18px; font-weight: bold; color: #333;">חשבונית מס / קבלה — Itay Solutions</div>
            <div style="font-size: 14px; color: #666; margin-top: 4px;">מס' חשבונית: {{ $invoiceNumber }} | תאריך: {{ $date }}</div>
        </div>
    </div>
    <div style="display: flex; gap: 32px; align-items: flex-start; margin-bottom: 12px;">
        <div style="flex:1; min-width:220px;">
            <div style="font-size: 16px; color: #7c3aed; font-weight: bold; margin-bottom: 6px;">פרטי העסק</div>
            איתי חרוש<br>
            Itay Solutions<br>
            עוסק זעיר<br>
            מספר עוסק: 305300808<br>
            טלפון: <a href="tel:0547466508">054-7466508</a><br>
            אימייל: <a href="mailto:itayyharoush@gmail.com">itayyharoush@gmail.com</a><br>
            אתר: <a href="https://itaysolutions.com">itaysolutions.com</a>
        </div>
        <div style="flex:1; min-width:220px;">
            <div style="font-size: 16px; color: #7c3aed; font-weight: bold; margin-bottom: 6px;">פרטי לקוח</div>
            לכבוד: {{ $customer_name ?? '-' }}<br>
        </div>
    </div>
    <div style="font-size: 16px; color: #7c3aed; font-weight: bold; margin: 18px 0 6px;">פרטי שירות</div>
    <table style="border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 15px;">
        <tr>
            <th style="border: 1px solid #bbb; padding: 8px 6px; text-align: center; background: #f7f7fa; color: #7c3aed;">תיאור שירות</th>
            <th style="border: 1px solid #bbb; padding: 8px 6px; text-align: center; background: #f7f7fa; color: #7c3aed;">כמות</th>
            <th style="border: 1px solid #bbb; padding: 8px 6px; text-align: center; background: #f7f7fa; color: #7c3aed;">מחיר ליחידה</th>
            <th style="border: 1px solid #bbb; padding: 8px 6px; text-align: center; background: #f7f7fa; color: #7c3aed;">סה"כ</th>
        </tr>
        @foreach($items as $item)
        <tr>
            <td style="border: 1px solid #bbb; padding: 8px 6px; text-align: center;">{{ $item['description'] }}</td>
            <td style="border: 1px solid #bbb; padding: 8px 6px; text-align: center;">{{ $item['quantity'] }}</td>
            <td style="border: 1px solid #bbb; padding: 8px 6px; text-align: center;">₪{{ number_format($item['unit_price'], 2) }}</td>
            <td style="border: 1px solid #bbb; padding: 8px 6px; text-align: center;">₪{{ number_format($item['quantity'] * $item['unit_price'], 2) }}</td>
        </tr>
        @endforeach
    </table>
    <div style="margin-top: 18px; font-size: 18px; color: #ff6600; font-weight: bold;">
        @if($toPay)
        סה"כ לתשלום: ₪{{ number_format($total, 2) }}
        <div style="font-size:13px; color:#888; font-weight:normal; margin-top:2px;">(עוסק פטור - לא כולל מע"מ)</div>
        @else
        שולם: ₪{{ number_format($total, 2) }} (כולל מע"מ)
        <div style="font-size:13px; color:#888; font-weight:normal; margin-top:2px;">(כולל מע"מ)</div>
        @endif
    </div>
    @if(!empty($promotionImagePaths) && count($promotionImagePaths) > 0)
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <div style="text-align: center;">
            @foreach($promotionImagePaths as $img)
            @php
                $imgSrc = $img['path'] ?? $img;
                $imgUrl = $img['url'] ?? null;
            @endphp
            @if(!empty($imgUrl))
            <a href="{{ $imgUrl }}" target="_blank" rel="noopener" style="display:inline-block; margin:6px 10px;">
                <img src="{{ $imgSrc }}" alt="פרסום" style="max-height: 180px; max-width: 280px; vertical-align: middle; border-radius: 8px;" />
            </a>
            @else
            <img src="{{ $imgSrc }}" alt="פרסום" style="max-height: 180px; max-width: 280px; margin: 6px 10px; vertical-align: middle; border-radius: 8px;" />
            @endif
            @endforeach
        </div>
    </div>
    @elseif(!empty($promotionImagesBase64) && count($promotionImagesBase64) > 0)
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <div style="text-align: center;">
            @foreach($promotionImagesBase64 as $img)
            @php
                $imgSrc = 'data:' . (is_array($img) ? ($img['mime'] ?? 'image/jpeg') : 'image/jpeg') . ';base64,' . (is_array($img) ? ($img['data'] ?? '') : $img);
                $imgUrl = is_array($img) ? ($img['url'] ?? null) : null;
            @endphp
            @if(!empty($imgUrl))
            <a href="{{ $imgUrl }}" target="_blank" rel="noopener" style="display:inline-block; margin:6px 10px;">
                <img src="{{ $imgSrc }}" alt="פרסום" style="max-height: 180px; max-width: 280px; vertical-align: middle; border-radius: 8px;" />
            </a>
            @else
            <img src="{{ $imgSrc }}" alt="פרסום" style="max-height: 180px; max-width: 280px; margin: 6px 10px; vertical-align: middle; border-radius: 8px;" />
            @endif
            @endforeach
        </div>
    </div>
    @endif
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <div style="font-size: 15px; font-weight: bold; color: #7c3aed;">תודה שבחרתם Itay Solutions</div>
    </div>
</div>
