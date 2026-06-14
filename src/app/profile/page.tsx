import { ProfileScreen } from "@/components/screens/ProfileScreen";

type SearchParams = Promise<{ reset?: string }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { reset } = await searchParams;
  return <ProfileScreen resetToken={reset} />;
}
