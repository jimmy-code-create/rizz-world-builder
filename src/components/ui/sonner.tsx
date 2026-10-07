import { Toaster as Sonner } from "sonner";
import { AlertCircle, CheckCircle2, Info, LoaderCircle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group rizz-toaster"
      position="bottom-center"
      offset={12}
      duration={3200}
      closeButton={false}
      icons={{
        success: <CheckCircle2 aria-hidden="true" />,
        error: <AlertCircle aria-hidden="true" />,
        info: <Info aria-hidden="true" />,
        loading: <LoaderCircle aria-hidden="true" />,
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
