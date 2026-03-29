import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Goal, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { AppLogo } from '@/components/icons';

const features = [
  {
    icon: <Goal className="h-8 w-8 text-primary" />,
    title: 'Create & Share Resolutions',
    description: 'Easily add your personal goals and share them with your team.',
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: 'Form Bingo Teams',
    description: 'Invite friends to a team and compete in a friendly bingo game.',
  },
  {
    icon: <CheckCircle2 className="h-8 w-8 text-primary" />,
    title: 'Track Your Progress',
    description: 'Mark resolutions as complete and see everyone\'s progress in real-time.',
  },
];

export default function Home() {
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero-1');

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center shadow-sm bg-card">
        <Link href="/" className="flex items-center justify-center gap-2">
          <AppLogo />
          <span className="font-semibold font-headline">Resolution Bingo</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Button variant="ghost" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="relative w-full pt-12 md:pt-24 lg:pt-32">
           {heroImage && (
            <Image
              src={heroImage.imageUrl}
              alt={heroImage.description}
              fill
              className="object-cover opacity-10"
              priority
              data-ai-hint={heroImage.imageHint}
            />
          )}
          <div className="relative container space-y-10 xl:space-y-16 px-4 md:px-6">
            <div className="grid max-w-[1300px] mx-auto gap-4 px-4 sm:px-6 md:px-10 md:grid-cols-2 md:gap-16">
              <div className="flex flex-col justify-center space-y-4">
                <h1 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem] font-headline">
                  Turn Your New Year's Goals into a Game
                </h1>
                <p className="max-w-[700px] text-foreground/80 md:text-xl">
                  Resolution Bingo transforms your personal goals into a fun, competitive, and collaborative team experience.
                </p>
              </div>
               {heroImage && (
                <div className="hidden md:flex justify-center">
                  <Image
                    src={heroImage.imageUrl}
                    alt={heroImage.description}
                    width={600}
                    height={400}
                    className="rounded-xl object-cover shadow-2xl"
                    data-ai-hint={heroImage.imageHint}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-background/50">
          <div className="container space-y-12 px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">Key Features</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">How It Works</h2>
                <p className="max-w-[900px] text-foreground/80 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Everything you need to stay motivated and achieve your goals together.
                </p>
              </div>
            </div>
            <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center gap-4 pb-4">
                    {feature.icon}
                    <CardTitle className="font-headline text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/80">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-foreground/60">&copy; 2026 Resolution Bingo.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          {/* TODO: Add links when pages are available
           <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacy
          </Link> */}
        </nav>
      </footer>
    </div>
  );
}
