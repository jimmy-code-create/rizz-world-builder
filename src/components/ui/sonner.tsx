import { Toaster as Sonner } from "sonner";
import { AlertCircle, CheckCircle2, Info, LoaderCircle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group rizz-toaster"
      position="bottom-center"
      offset={12}
      gap={10}
      duration={3600}
      visibleToasts={3}
      closeButton={false}
      icons={{
        success: <CheckCircle2 aria-hidden="true" />,
        error: <AlertCircle aria-hidden="true" />,
        info: <Info aria-hidden="true" />,
        loading: <LoaderCircle aria-hidden="true" className="animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "rizz-toast",
          title: "rizz-toast-title",
          description: "rizz-toast-description",
          icon: "rizz-toast-icon",
          actionButton: "rizz-toast-action",
          cancelButton: "rizz-toast-cancel",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
