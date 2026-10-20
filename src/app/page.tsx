import Image from "next/image";
import el from "@/i18n/el.json";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Image src="/logo.png" alt="Coffee Pause Cyprus" width={96} height={96} priority />
      <h1 className="text-2xl font-semibold">{el.meta.title}</h1>
    </main>
  );
}
