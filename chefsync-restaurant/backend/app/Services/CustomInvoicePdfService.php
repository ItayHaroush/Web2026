<?php

namespace App\Services;

use Mpdf\Mpdf;

class CustomInvoicePdfService
{
    public function generatePdf(array $data): Mpdf
    {
        ini_set('pcre.backtrack_limit', '5000000');
        $html = view('invoices.itay_invoice', $data)->render();
        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'directionality' => 'rtl',
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
            'biDirectional' => true,
            'default_font' => 'dejavusans',
            'tempDir' => storage_path('app/mpdf-temp'),
            'margin_bottom' => 25,
        ]);
        $mpdf->SetHTMLFooter('
            <div style="border-top: 1px solid #e5e7eb; padding-top: 6px; text-align: center; color: #9ca3af; font-size: 9px; direction: rtl;">
                Itay Solutions | חשבונית זו הופקה אוטומטית ממערכת TakeEat
            </div>
        ');
        // פיצול CSS ו-HTML
        $css = '';
        $body = $html;
        if (preg_match('/<style.*?>(.*?)<\/style>/is', $html, $matches)) {
            $css = $matches[1];
            $body = preg_replace('/<style.*?>.*?<\/style>/is', '', $html);
        }
        if ($css) {
            $mpdf->WriteHTML($css, \Mpdf\HTMLParserMode::HEADER_CSS);
        }
        $mpdf->WriteHTML($body, \Mpdf\HTMLParserMode::HTML_BODY);
        return $mpdf;
    }

    public function streamPdf(array $data)
    {
        $mpdf = $this->generatePdf($data);
        $filename = 'ItaySolutions-Invoice-' . ($data['invoiceNumber'] ?? 'custom') . '.pdf';
        return response($mpdf->Output($filename, \Mpdf\Output\Destination::STRING_RETURN), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    public function downloadPdf(array $data)
    {
        $mpdf = $this->generatePdf($data);
        $filename = 'ItaySolutions-Invoice-' . ($data['invoiceNumber'] ?? 'custom') . '.pdf';
        return response($mpdf->Output($filename, \Mpdf\Output\Destination::STRING_RETURN), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
}
