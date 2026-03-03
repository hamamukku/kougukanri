import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_ROLE_COOKIE = "role";

export default async function Page() {
  const cookieStore = await cookies();
  const role = cookieStore.get(AUTH_ROLE_COOKIE)?.value;
  redirect(role === "admin" ? "/admin/returns" : "/tools");
}
