<?php

namespace App\Services;

use Mpdf\Mpdf;

class CustomInvoicePdfService
{
    /** @var list<string> Temp image paths to delete after PDF generation */
    private array $tempImagePaths = [];

    public function generatePdf(array $data): Mpdf
    {
        $data = $this->convertBase64ImagesToTempFiles($data);

        try {
            $html = view('invoices.itay_invoice_content', $data)->render();
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
                <table width="100%" style="border-top: 1px solid #e5e7eb; padding-top: 8px; direction: rtl;">
                    <tr>
                        <td style="text-align: center; color: #6b7280; font-size: 10px;">
                            <strong>Itay Solutions</strong> | עוסק זעיר | 305300808<br>
                            &#9742; <a href="tel:0547466508" style="color:#7c3aed; text-decoration:none;">054-7466508</a> &nbsp;|&nbsp;
                            &#9993; <a href="mailto:itayyharoush@gmail.com" style="color:#7c3aed; text-decoration:none;">itayyharoush@gmail.com</a> &nbsp;|&nbsp;
                            &#187; <a href="https://itaysolutions.com" style="color:#7c3aed; text-decoration:none;">itaysolutions.com</a><br>
                            <span style="color:#9ca3af; font-size: 9px;">חשבונית זו הופקה אוטומטית ממערכת TakeEat</span>
                        </td>
                    </tr>
                </table>
            ');

            [$css, $body] = $this->extractCssAndBody($html);
            if ($css !== '') {
                $mpdf->WriteHTML($css, \Mpdf\HTMLParserMode::HEADER_CSS);
            }
            $mpdf->WriteHTML($body, \Mpdf\HTMLParserMode::HTML_BODY);
            return $mpdf;
        } finally {
            $this->cleanupTempImages();
        }
    }

    /**
     * Convert base64 images to temp files to reduce HTML size and avoid pcre.backtrack_limit.
     */
    private function convertBase64ImagesToTempFiles(array $data): array
    {
        $tempDir = storage_path('app/mpdf-temp');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        if (!empty($data['logoBase64'])) {
            $decoded = base64_decode($data['logoBase64'], true);
            if ($decoded !== false && strlen($decoded) > 0) {
                $ext = $this->mimeToExt('image/png');
                $path = $tempDir . '/logo_' . uniqid() . $ext;
                if (file_put_contents($path, $decoded)) {
                    $data['logoPath'] = $path;
                    $this->tempImagePaths[] = $path;
                }
            }
            unset($data['logoBase64']);
        }

        if (!empty($data['promotionImagesBase64'])) {
            $data['promotionImagePaths'] = [];
            foreach ($data['promotionImagesBase64'] as $img) {
                $mime = is_array($img) ? ($img['mime'] ?? 'image/jpeg') : 'image/jpeg';
                $raw = is_array($img) ? ($img['data'] ?? '') : $img;
                $url = is_array($img) ? ($img['url'] ?? null) : null;
                if (empty($raw)) continue;
                $decoded = base64_decode($raw, true);
                if ($decoded === false || strlen($decoded) === 0) continue;
                $ext = $this->mimeToExt($mime);
                $path = $tempDir . '/prom_' . uniqid() . $ext;
                if (file_put_contents($path, $decoded)) {
                    $data['promotionImagePaths'][] = ['path' => $path, 'url' => $url];
                    $this->tempImagePaths[] = $path;
                }
            }
            unset($data['promotionImagesBase64']);
        }

        return $data;
    }

    private function mimeToExt(string $mime): string
    {
        return match ($mime) {
            'image/png' => '.png',
            'image/gif' => '.gif',
            'image/webp' => '.webp',
            default => '.jpg',
        };
    }

    private function cleanupTempImages(): void
    {
        foreach ($this->tempImagePaths as $path) {
            if (file_exists($path)) {
                @unlink($path);
            }
        }
        $this->tempImagePaths = [];
    }

    /**
     * Extract CSS and body without regex on large strings (avoids pcre.backtrack_limit).
     */
    private function extractCssAndBody(string $html): array
    {
        $styleStart = stripos($html, '<style');
        if ($styleStart === false) {
            return ['', $html];
        }
        $contentStart = strpos($html, '>', $styleStart) + 1;
        $styleEnd = stripos($html, '</style>', $contentStart);
        if ($styleEnd === false) {
            return ['', $html];
        }
        $css = substr($html, $contentStart, $styleEnd - $contentStart);
        $body = substr($html, 0, $styleStart) . substr($html, $styleEnd + 8);
        return [$css, $body];
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

    public function getPdfContent(array $data): string
    {
        $mpdf = $this->generatePdf($data);
        return $mpdf->Output('', \Mpdf\Output\Destination::STRING_RETURN);
    }
}
