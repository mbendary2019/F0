#!/bin/bash

echo "🔍 فحص بيانات Firestore..."
echo ""

# Send a test event
echo "📤 إرسال حدث اختبار..."
RESULT=$(curl -s -X POST "http://127.0.0.1:5001/from-zero-84253/us-central1/log" \
  -H 'Content-Type: application/json' \
  -d '{"level":"error","service":"web","code":500,"message":"Check script test","fingerprint":"check-test"}')

echo "   الاستجابة: $RESULT"
echo ""

# Wait for trigger to process
echo "⏳ انتظار 3 ثواني لمعالجة الـ trigger..."
sleep 3
echo ""

echo "📊 لعرض البيانات، افتح هذه الروابط:"
echo ""
echo "1️⃣ Firestore Emulator UI:"
echo "   http://localhost:4000/firestore"
echo ""
echo "2️⃣ Dashboard (يتطلب admin claims):"
echo "   http://localhost:3000/ar/ops/incidents"
echo ""
echo "3️⃣ Test Page (بدون admin):"
echo "   http://localhost:3000/test-toast"
echo ""

echo "✅ يجب أن تشوف:"
echo "   • ops_events: الأحداث المرسلة"
echo "   • ops_incidents: الـ incidents (إذا كان الـ trigger شغال)"
echo "   • ops_incident_updates: تحديثات الحالة"
echo ""

echo "⚠️  إذا ما شفت ops_incidents:"
echo "   1. تحقق من Functions logs في Terminal الثاني"
echo "   2. شوف رسائل الـ error في logs"
echo "   3. تأكد أن الـ emulator شغال بشكل صحيح"
echo ""

echo "🧪 لإرسال spike test (12 error):"
echo "   bash seed-incidents.sh"
echo ""
