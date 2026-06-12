// Auth provider abstraction. All auth calls go through this module.
// Swap the implementation here to change providers without touching the rest of the app.

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
};

export async function getSession(): Promise<AuthUser | null> {
  // TODO: integrate with Convex Auth
  return null;
}

export async function signIn(
  _email: string,
  _password: string,
): Promise<void> {
  // TODO: integrate with Convex Auth
  throw new Error('Not implemented');
}

export async function signOut(): Promise<void> {
  // TODO: integrate with Convex Auth
  throw new Error('Not implemented');
}

export async function signUp(
  _name: string,
  _email: string,
  _password: string,
): Promise<void> {
  // TODO: integrate with Convex Auth
  throw new Error('Not implemented');
}
