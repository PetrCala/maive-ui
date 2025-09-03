import HoverableIconButton from "@src/components/Buttons/HoverableIconButton";
import { useRouter } from "next/navigation";
import { FaHome } from "react-icons/fa";

type HomeIconProps = {
  className?: string;
  buttonClassName?: string;
};

export default function HomeIcon({
  className = "",
  buttonClassName = "",
}: HomeIconProps) {
  const router = useRouter();

  return (
    <HoverableIconButton
      ariaLabel="Home"
      icon={<FaHome />}
      className={className}
      onClick={() => {
        router.push("/");
      }}
      buttonClassName={buttonClassName}
    />
  );
}
