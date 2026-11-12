/* ตั้งค่าการเข้าสู่ระบบ Microsoft 365 ของเว็บ static
   ไม่มีความลับในไฟล์นี้ (client/tenant/group ID เปิดเผยได้) — คัดลอกเป็น static/auth-config.js แล้วใส่ค่าจริง */
window.DASH_AUTH = {
  clientId: '<Application (client) ID ของ App registration แบบ SPA>',
  tenantId: '<Directory (tenant) ID>',
  groupId: '<Object ID ของกลุ่มผู้มีสิทธิ์ดู>',            // ไม่ใส่ = ทุกคนใน tenant ผ่านด่านกลุ่ม (ยังต้องมีสิทธิ์อ่านไฟล์กุญแจ)
  groupName: '<ชื่อกลุ่ม ใช้แสดงในข้อความแจ้งเตือน>',
  keyShareUrl: '<ลิงก์แชร์ไฟล์กุญแจใน SharePoint/OneDrive (แชร์เฉพาะกลุ่มผู้ดู)>',
  // redirectUri: 'https://<owner>.github.io/<repo>/',     // ไม่ใส่ = ใช้ URL ของหน้าเว็บเอง
};
