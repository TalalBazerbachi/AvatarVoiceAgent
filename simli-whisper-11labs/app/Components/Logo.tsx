'use client';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import logo from '@/media/takhlees_logo.webp';
import cn from '@/app/utils/TailwindMergeAndClsx';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

const SimliHeaderLogo = ({ className, children }: Props) => {
  const router = useRouter();
  const pathname = usePathname();

  const handleClick = async () => {
    console.log('Clicked Byte logo');
    window.location.href = 'https://takhlees.ae';
  };

  return (
    <div className={cn('fixed top-[32px] left-[32px] cursor-pointer', className)} onClick={handleClick}>
      <Image 
        src={logo} 
        className='Logo'
        alt='Byte logo'
        width={200}
        height={80}
      />
    </div>
  );
};

export default SimliHeaderLogo;
