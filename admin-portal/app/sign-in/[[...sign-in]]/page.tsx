import { SignIn } from '@clerk/nextjs'

export default function SignInPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: '#0F172A' }}>
      {/* Logo / brand */}
      <div className="text-center">
        <h1 className="text-3xl font-bold" style={{ color: '#00C5E3' }}>
          MailyT-Cuida
        </h1>
        <p className="text-slate-400 text-sm mt-1">Portal de administración</p>
      </div>

      {/* Error message */}
      {searchParams.error === 'unauthorized' && (
        <div className="bg-red-900/40 border border-red-500 text-red-300 text-sm px-4 py-3 rounded-lg max-w-sm text-center">
          Tu cuenta no tiene permisos de administrador.
          Contacta al equipo de soporte.
        </div>
      )}

      <SignIn
        appearance={{
          variables: {
            colorPrimary: '#00C5E3',
            colorBackground: '#1E293B',
            colorText: '#F1F5F9',
            colorInputBackground: '#0F172A',
            colorInputText: '#F1F5F9',
          },
        }}
      />
    </div>
  )
}
