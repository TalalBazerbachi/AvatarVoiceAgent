import logo from '@/media/bytebeam-black.png';
import Image from 'next/image';
export default function Navbar() {
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full md:w-auto">
      <nav>
        <ul className="font-medium flex p-4 md:p-0 mt-4  rounded-lg bg-white md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0 md:bg-white dark:bg-white md:dark:bg-white">
          <li>
            <div className="flex items-center gap-2">
              <span className="text-gray-900 dark:text-balck">Powered By</span>
              <a
                onClick={() => {
                  window.open("https://bytebeam.co");
                }}
                className="cursor-pointer"
              >
                <Image
                  src={logo}
                  alt="ByteBeam Logo" 
                  width={120}
                  height={60}
                />
              </a>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );
}
