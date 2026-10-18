import { localDev, type AuthFn, vercelOidc } from "eve/channels/auth";
import { matchesServiceToken } from "@agent-template/agent-eve/trust-policy";

export function createEveChannelAuth(
  env: Record<string, string | undefined> = process.env,
): AuthFn<Request>[] {
  const auth: AuthFn<Request>[] = [serviceTokenAuth(env.EVE_AGENT_SERVICE_TOKEN), vercelOidc()];

  if (env.NODE_ENV !== "production") {
    auth.push(localDev());
  }

  return auth;
}

export function serviceTokenAuth(expected: string | undefined): AuthFn<Request> {
  return (request) => {
    if (!expected) {
      return null;
    }

    return matchesServiceToken(request.headers.get("x-agent-template-eve-token"), expected)
      ? servicePrincipal()
      : null;
  };
}

function servicePrincipal() {
  return {
    attributes: {},
    authenticator: "agent-template-api",
    principalId: "agent-template-api",
    principalType: "service" as const,
  };
}
