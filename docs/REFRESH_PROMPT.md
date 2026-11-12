# Prompt สำหรับ refresh snapshot (ใช้ในแชท Claude โปรเจกต์ TR-CLOUD)
อ่านอย่างเดียว ห้ามสร้าง/แก้/ลบ/อนุมัติเอกสาร
1. สำหรับแต่ละ connector TRCloud_STG_NEW, TRCloud_STP_NEW, TRCloud_TWP_NEW: เรียก get_iv3_sales_report date-from=2026-01-01 date-to=<วันนี้> limit=5000 start=0,5000,10000,… จนได้หน้าที่มีน้อยกว่า 5000 แถว และ get_cn3_credit_note_report แบบเดียวกัน
2. หลังแต่ละหน้า รัน `python scripts/ingest.py <co>_iv3_2026_p<N> <CO>_NEW-get_iv3` (หรือ cn3) เพื่อย้ายผลลัพธ์เข้า raw/ — ถ้าผลลัพธ์เล็กพอที่จะแสดงในแชท ให้บันทึก JSON ที่ได้ลงไฟล์ raw/ ตามชื่อเดียวกัน
3. ตรวจว่าจำนวน item_id ไม่ซ้ำเท่ากับจำนวนแถว จากนั้นรัน build_model.py และ validate.py
4. ถ้าบริษัทใดล้มเหลว ให้คงไฟล์ raw/ ชุดเดิมของบริษัทนั้นไว้และรายงาน
5. รัน `python3 scripts/build_model.py` → `python3 scripts/validate.py` → `node scripts/build-static.js --key <กุญแจนอก repo> --out site` → push เฉพาะ site/ และโค้ด
