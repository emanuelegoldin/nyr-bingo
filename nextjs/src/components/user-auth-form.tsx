"use client";

/**
 * User Authentication Form
 * Spec Reference: 01-authentication.md - Registration, Login
 */

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

/** Translator for the Auth namespace. */
type AuthTranslator = ReturnType<typeof useTranslations<"Auth">>;

/**
 * Builds the login validation schema with messages in the active locale.
 *
 * @param t - Translator of the Auth namespace.
 * @returns The zod schema for the login form.
 */
const createLoginSchema = (t: AuthTranslator) => z.object({
  email: z.string().email({ message: t("validation.emailInvalid") }),
  password: z.string().min(1, { message: t("validation.passwordRequired") }),
});

/**
 * Builds the registration validation schema with messages in the active locale.
 *
 * @param t - Translator of the Auth namespace.
 * @returns The zod schema for the registration form.
 */
const createRegisterSchema = (t: AuthTranslator) => z.object({
  username: z.string().min(3, { message: t("validation.usernameMin") }),
  email: z.string().email({ message: t("validation.emailInvalid") }),
  password: z.string().min(8, { message: t("validation.passwordMin") }),
});

type LoginFormData = z.infer<ReturnType<typeof createLoginSchema>>;
type RegisterFormData = z.infer<ReturnType<typeof createRegisterSchema>>;

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: "login" | "register";
}

function LoginForm({ className, ...props }: Omit<UserAuthFormProps, 'variant'>) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations("Auth");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  const loginSchema = React.useMemo(() => createLoginSchema(t), [t]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });
  const isLoading = form.formState.isSubmitting;

  async function onSubmit(data: LoginFormData) {

    const result = await apiFetch<unknown>('/api/auth/login', {
      method: 'POST',
      json: data,
    });

    if (result.ok) {
      toast({
        title: tc("success"),
        description: t("loginSuccess"),
      });
      router.push("/dashboard");
    } else {
      toastApiError(result, t("loginFailed"));
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email")}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder={t("emailPlaceholder")} {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("password")}</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("signIn")}
          </Button>
        </form>
      </Form>
    </div>
  );
}

function RegisterForm({ className, ...props }: Omit<UserAuthFormProps, 'variant'>) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations("Auth");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  const registerSchema = React.useMemo(() => createRegisterSchema(t), [t]);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: ""
    }
  });
  const isLoading = form.formState.isSubmitting;

  async function onSubmit(data: RegisterFormData) {

    const result = await apiFetch<unknown>('/api/auth/register', {
      method: 'POST',
      json: data,
    });

    if (result.ok) {
      toast({
        title: tc("success"),
        description: t("registerSuccess"),
      });
      router.push("/login");
    } else {
      toastApiError(result, t("registerFailed"));
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("username")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("usernamePlaceholder")} {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email")}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder={t("emailPlaceholder")} {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("password")}</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("createAccount")}
          </Button>
        </form>
      </Form>
    </div>
  );
}

export function UserAuthForm({ variant, ...props }: UserAuthFormProps) {
  if (variant === "login") {
    return <LoginForm {...props} />;
  }
  return <RegisterForm {...props} />;
}
