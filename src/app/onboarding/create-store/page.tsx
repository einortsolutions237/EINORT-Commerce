import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { strings } from "@/lib/strings";
import { auth } from "@/server/auth/auth";
import { platformDb } from "@/server/db/platform";

import { CreateStoreForm } from "./create-store-form";

/**
 * Recovery for the one genuinely non-atomic step in Phase 1.
 *
 * `signUpEmail` and `createOrganization` are two Better Auth endpoints and
 * cannot be wrapped in one transaction, so a merchant can end up with an
 * account and no store. Without this route they are stranded in the worst
 * possible way: their email is taken, so signing up again fails, and there is
 * nothing for them to sign in to. Every authenticated user with zero
 * organizations belongs here.
 *
 * IDENTITY COMES FROM THE SESSION AND NOWHERE ELSE (T-01-49). This page reads
 * no search parameter and no route parameter, and the action it renders accepts
 * only a slug — there is no user id or organization id anywhere in the request
 * for an attacker to substitute in order to provision a store onto someone
 * else's account.
 *
 * D-03 note: because a store address is changeable in principle, the merchant
 * self-service address-change UI planned for Phase 4 belongs on this route
 * rather than in a new one — it is already the "choose your address" surface
 * for an authenticated merchant. No such UI is built in Phase 1.
 */

export const metadata: Metadata = {
  title: strings.createStore.title,
};

export default async function CreateStorePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Not signed in: this surface has nothing to offer an anonymous visitor, and
  // the only way to get an account is the signup form.
  if (!session) redirect("/signup");

  /**
   * This page is for the zero-organization case only. A merchant who already
   * has a store landing here — a stale tab, a bookmark, a double submit — is
   * sent to the store they already have rather than being shown a form that
   * `organizationLimit: 1` would refuse.
   */
  const existing = await platformDb.organization.findFirst({
    where: { members: { some: { userId: session.user.id } } },
    select: { slug: true },
  });

  if (existing) {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "einort.com";
    // Their storefront is a different host, so this is an absolute redirect.
    // `http` locally, `https` everywhere a real root domain is configured.
    const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
    redirect(`${protocol}://${existing.slug}.${rootDomain}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-8">
      <div className="w-full max-w-md">
        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.createStore.heading}
        </h1>

        <Card className="mt-8 rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardContent className="flex flex-col gap-6">
            {/*
             * States what happened before asking for anything, per the
             * 01-UI-SPEC.md voice contract. Destructive because it reports a
             * failure the merchant did not cause and has to act on.
             */}
            <Alert variant="destructive">
              <AlertDescription className="text-destructive">
                {strings.createStore.notice}
              </AlertDescription>
            </Alert>

            <CreateStoreForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
