import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Lovask">
      <Image
        src="/logo_l_extra_thick.png"
        alt="Lovask" 
        width={compact ? 30 : 45}
        height={compact ? 24 : 36}
        style={{ objectFit: 'contain' }} 
        priority 
      />
    </div>
  );
}
