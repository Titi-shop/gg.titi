// utils/validateEmail.ts
import { validEmailDomains, blockedEmailDomains } from "@/data/validEmailDomains";

export function isValidEmailFormat(email: string) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.toLowerCase());
}

export function getEmailDomain(email: string) {
  return email.split("@")[1].toLowerCase();
}

export function validateEmail(email: string) {
  if (!email) return { valid: false, message: "Email không được bỏ trống" };

  if (!isValidEmailFormat(email))
    return { valid: false, message: "Email không đúng định dạng" };

  const domain = getEmailDomain(email);

  // chặn domain rác
  if (blockedEmailDomains.includes(domain))
    return { valid: false, message: "Email này không được hỗ trợ" };

  // Gmail sai chính tả
  const gmailMistakes = ["gmial.com", "gmal.com", "gmai.com", "gmail.con"];
  if (gmailMistakes.includes(domain))
    return { valid: false, message: "Bạn đã nhập sai Gmail. Hãy kiểm tra lại." };

  // nếu domain hợp lệ trong danh sách whitelist
  if (validEmailDomains.includes(domain))
    return { valid: true, message: "Email hợp lệ" };

  // domain hợp lệ theo cấu trúc nhưng không trong danh sách
  return {
    valid: true,
    message: "Email hợp lệ (domain mới, không phổ biến)"
  };
}
