const telexMap: Record<string, string> = {
  // Lowercase
  "á": "AS", "à": "AF", "ả": "AR", "ã": "AX", "ạ": "AJ",
  "ă": "AW", "ắ": "AWS", "ằ": "AWF", "ẳ": "AWR", "ẵ": "AWX", "ặ": "AWJ",
  "â": "AA", "ấ": "AAS", "ầ": "AAF", "ẩ": "AAR", "ẫ": "AAX", "ậ": "AAJ",
  "é": "ES", "è": "EF", "ẻ": "ER", "ẽ": "EX", "ẹ": "EJ",
  "ê": "EE", "ế": "EES", "ề": "EEF", "ể": "EER", "ễ": "EEX", "ệ": "EEJ",
  "í": "IS", "ì": "IF", "ỉ": "IR", "ĩ": "IX", "ị": "IJ",
  "ó": "OS", "ò": "OF", "ỏ": "OR", "õ": "OX", "ọ": "OJ",
  "ô": "OO", "ố": "OOS", "ồ": "OOF", "ổ": "OOR", "ỗ": "OOX", "ộ": "OOJ",
  "ơ": "OW", "ớ": "OWS", "ờ": "OWF", "ở": "OWR", "ỡ": "OWX", "ợ": "OWJ",
  "ú": "US", "ù": "UF", "ủ": "UR", "ũ": "UX", "ụ": "UJ",
  "ư": "UW", "ứ": "UWS", "ừ": "UWF", "ử": "UWR", "ữ": "UWX", "ự": "UWJ",
  "ý": "YS", "ỳ": "YF", "ỷ": "YR", "ỹ": "YX", "ỵ": "YJ",
  "đ": "DD",

  // Uppercase
  "Á": "AS", "À": "AF", "Ả": "AR", "Ã": "AX", "Ạ": "AJ",
  "Ă": "AW", "Ắ": "AWS", "Ằ": "AWF", "Ẳ": "AWR", "Ẵ": "AWX", "Ặ": "AWJ",
  "Â": "AA", "Ấ": "AAS", "Ầ": "AAF", "Ẩ": "AAR", "Ẫ": "AAX", "Ậ": "AAJ",
  "É": "ES", "È": "EF", "Ẻ": "ER", "Ẽ": "EX", "Ẹ": "EJ",
  "Ê": "EE", "Ế": "EES", "Ề": "EEF", "Ể": "EER", "Ễ": "EEX", "Ệ": "EEJ",
  "Í": "IS", "Ì": "IF", "Ỉ": "IR", "Ĩ": "IX", "Ị": "IJ",
  "Ó": "OS", "Ò": "OF", "Ỏ": "OR", "Õ": "OX", "Ọ": "OJ",
  "Ô": "OO", "Ố": "OOS", "Ồ": "OOF", "Ổ": "OOR", "Ỗ": "OOX", "Ộ": "OOJ",
  "Ơ": "OW", "Ớ": "OWS", "Ờ": "OWF", "Ở": "OWR", "Ỡ": "OWX", "Ợ": "OWJ",
  "Ú": "US", "Ù": "UF", "Ủ": "UR", "Ũ": "UX", "Ụ": "UJ",
  "Ư": "UW", "Ứ": "UWS", "Ừ": "UWF", "Ử": "UWR", "Ữ": "UWX", "Ự": "UWJ",
  "Ý": "YS", "Ỳ": "YF", "Ỷ": "YR", "Ỹ": "YX", "Ỵ": "YJ",
  "Đ": "DD"
};

export function restoreTelexAndUppercase(str: string): string {
  if (!str) return "";
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (telexMap[char]) {
      result += telexMap[char];
    } else {
      result += char;
    }
  }
  return result.toUpperCase();
}

export function removeVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}
