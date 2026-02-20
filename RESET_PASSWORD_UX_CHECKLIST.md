# Reset Password UX Checklist

Use this checklist when verifying `/reset-password?token=...`.

## Happy Path
- [ ] User opens reset link with valid token and sees reset form.
- [ ] User enters matching passwords (8+ chars) and submits successfully.
- [ ] Success message is shown.
- [ ] User is redirected to `/login`.
- [ ] User can log in with the new password.

## Invalid Link / Token
- [ ] Missing token query param shows clear error.
- [ ] Invalid token shows backend error message.
- [ ] Expired token shows backend error message.

## Validation Behavior
- [ ] Password mismatch blocks submit with clear message.
- [ ] Password shorter than 8 chars is blocked.
- [ ] Submit button is disabled while request is in-flight.

## Localization
- [ ] English copy is correct.
- [ ] Arabic copy is correct and readable in RTL.
- [ ] Turkish copy is correct.

## Regression
- [ ] Back-to-login link works.
- [ ] Forgot-password flow still sends reset emails normally.
