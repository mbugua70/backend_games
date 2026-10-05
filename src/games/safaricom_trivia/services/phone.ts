// Kenyan mobile numbers only - this is a Safaricom activation. Accepts the
// formats people actually type at an event (0712 345 678, 712345678,
// +254712345678, 254-712-345-678) and returns the canonical 2547XXXXXXXX /
// 2541XXXXXXXX form, or null if it isn't a valid Kenyan mobile number.
// Normalizing is what makes "one play per phone" hold: without it the same
// person could register once as 07... and again as +2547...
export const normalizeKenyanPhone = (raw: string): string | null => {
  const digits = raw.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) {
    return null;
  }

  let local: string;
  if (digits.startsWith("254") && digits.length === 12) {
    local = digits.slice(3);
  } else if (digits.startsWith("0") && digits.length === 10) {
    local = digits.slice(1);
  } else if (digits.length === 9) {
    local = digits;
  } else {
    return null;
  }

  return /^[17]\d{8}$/.test(local) ? `254${local}` : null;
};
