#!/bin/bash

# schema-compare.sh
# השוואת סכימת בסיס נתונים בין לוקאלי ופרודקשן
# שימוש: ./schema-compare.sh <remote-url> <remote-token> [output-file]

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ שימוש: $0 <remote-url> <remote-token> [output-file]"
    echo ""
    echo "דוגמה:"
    echo "  $0 https://yourdomain.com your-bearer-token"
    echo "  $0 https://yourdomain.com your-bearer-token schema-diff.json"
    exit 1
fi

REMOTE_URL="$1"
REMOTE_TOKEN="$2"
OUTPUT="${3:-schema-report.json}"

echo "🔍 השוואת סכימה..."
echo ""

# הרץ את ה-Artisan command עם הפרמטרים
php artisan schema:compare \
    --remote-url="$REMOTE_URL" \
    --remote-token="$REMOTE_TOKEN" \
    --output="$OUTPUT"

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ דוח שמור ב- $OUTPUT"
    echo ""
    echo "כדי לצפות בתוך ה-JSON:"
    echo "  cat $OUTPUT | jq ."
    echo ""
    echo "כדי לבדוק רק את ההשוואה:"
    echo "  cat $OUTPUT | jq '.comparison'"
fi

exit $exit_code
