import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, ExternalLink } from "lucide-react";

export default function Redirect() {
  const { shortId } = useParams<{ shortId: string }>();
  const [status, setStatus] = useState<"loading" | "redirecting" | "expired" | "not-found" | "error">("loading");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!shortId) {
      setStatus("not-found");
      return;
    }

    const checkAndRedirect = async () => {
      try {
        // Check if the link exists and get its details
        const response = await fetch(`/api/links/${shortId}`);
        
        if (response.status === 404) {
          setStatus("not-found");
          return;
        }
        
        if (!response.ok) {
          setStatus("error");
          return;
        }
        
        const linkData = await response.json();
        
        if (linkData.isExpired) {
          setStatus("expired");
          return;
        }
        
        // Link exists and is valid, redirect to the actual endpoint
        // Use a small delay to show "redirecting" state
        setStatus("redirecting");
        
        // Start countdown
        let countdownValue = 3;
        setCountdown(countdownValue);
        
        const countdownInterval = setInterval(() => {
          countdownValue--;
          setCountdown(countdownValue);
          
          if (countdownValue <= 0) {
            clearInterval(countdownInterval);
            window.location.href = `/t/${shortId}`;
          }
        }, 1000);
      } catch (error) {
        console.error("Error checking link:", error);
        setStatus("error");
      }
    };

    // Small delay to show loading state, then check and redirect
    const timer = setTimeout(checkAndRedirect, 100);
    
    return () => clearTimeout(timer);
  }, [shortId]);

  const getStatusContent = () => {
    switch (status) {
      case "loading":
        return {
          icon: <Clock className="h-8 w-8 text-blue-500 animate-spin" />,
          title: "Loading Link...",
          description: "Please wait while we verify your link.",
          bgColor: "bg-slate-900",
        };
      case "redirecting":
        return {
          icon: <ExternalLink className="h-8 w-8 text-blue-500" />,
          title: `Redirecting in ${countdown}...`,
          description: "You will be redirected to your destination shortly.",
          bgColor: "bg-slate-900",
        };
      case "expired":
        return {
          icon: <AlertCircle className="h-8 w-8 text-red-500" />,
          title: "Link Expired",
          description: "This temporary link has expired and is no longer valid.",
          bgColor: "bg-slate-900",
        };
      case "not-found":
        return {
          icon: <AlertCircle className="h-8 w-8 text-red-500" />,
          title: "Link Not Found",
          description: "The requested link does not exist or has been removed.",
          bgColor: "bg-slate-900",
        };
      case "error":
        return {
          icon: <AlertCircle className="h-8 w-8 text-red-500" />,
          title: "Error",
          description: "An error occurred while processing your request.",
          bgColor: "bg-slate-900",
        };
      default:
        return {
          icon: <AlertCircle className="h-8 w-8 text-red-500" />,
          title: "Unknown Error",
          description: "Something went wrong.",
          bgColor: "bg-slate-900",
        };
    }
  };

  const { icon, title, description, bgColor } = getStatusContent();

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <Card className={`w-full max-w-md mx-4 ${bgColor} border-slate-700`}>
        <CardContent className="p-6 sm:pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {icon}
            <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
            <p className="text-slate-400 text-sm sm:text-base">{description}</p>
            
            {status === "expired" || status === "not-found" || status === "error" ? (
              <div className="mt-6">
                <a
                  href="/"
                  className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm sm:text-base"
                >
                  Create New Link
                </a>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
