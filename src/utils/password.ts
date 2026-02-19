export type PasswordCheck = {
  lengthOk: boolean;
  maxLengthOk: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  noSpaces: boolean;
  notEmail: boolean;
  score: number; // 0-5
  strength: "Weak" | "Fair" | "Good" | "Strong" | "Very Strong";
  valid: boolean;
};

export function validatePassword(password: string, email?: string): PasswordCheck {
  // Return default weak values for empty password
  if (!password || password.length === 0) {
    return {
      lengthOk: false,
      maxLengthOk: true,
      hasUpper: false,
      hasLower: false,
      hasNumber: false,
      hasSymbol: false,
      noSpaces: true,
      notEmail: true,
      score: 0,
      strength: "Weak",
      valid: false,
    };
  }

  const lengthOk = password.length >= 8;
  const maxLengthOk = password.length <= 64;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^\w\s]/.test(password); // any non-word, non-space
  const noSpaces = !/\s/.test(password);

  let notEmail = true;
  if (email) {
    const [local, domain] = email.toLowerCase().split("@");
    const p = password.toLowerCase();
    if (local && p.includes(local)) notEmail = false;
    if (domain && p.includes(domain)) notEmail = false;
  }

  // Score based on satisfied core checks
  const coreChecks = [lengthOk, hasUpper, hasLower, hasNumber, hasSymbol, noSpaces];
  let score = coreChecks.reduce((acc, ok) => acc + (ok ? 1 : 0), 0);
  
  // Don't give bonus points if basic requirements aren't met
  if (lengthOk && hasUpper && hasLower && hasNumber && hasSymbol && noSpaces) {
    if (password.length >= 12) score += 1; // bonus for longer length
    if (password.length >= 16) score += 1; // extra bonus
  }
  
  // Normalize to 0-5
  score = Math.min(5, Math.max(0, score));

  const strength = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : score === 4 ? "Strong" : "Very Strong";

  const valid = lengthOk && maxLengthOk && hasUpper && hasLower && hasNumber && hasSymbol && noSpaces && notEmail;

  return { lengthOk, maxLengthOk, hasUpper, hasLower, hasNumber, hasSymbol, noSpaces, notEmail, score, strength, valid };
}
