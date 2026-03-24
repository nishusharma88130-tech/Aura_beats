import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Loader2, Smile, Frown, Meh, Music, Play, Sparkles, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';

// ==========================================
// 🔑 ADD YOUR GEMINI API KEY HERE
// ==========================================
// If you are running this locally or deploying to Netlify, 
// paste your Gemini API key between the quotes below.
const MANUAL_GEMINI_API_KEY = "AIzaSyA1ZTftnBidWRgdRZHAGVxxDTHrCfYFVYA"; 
// ==========================================

type Emotion = 'HAPPY' | 'SAD' | 'NEUTRAL';
type Platform = 'youtube' | 'spotify' | 'jiosaavn';

// SVG Icons
const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const JioSaavnIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M14.5 8.5c0-1.4-1.1-2.5-2.5-2.5s-2.5 1.1-2.5 2.5c0 2.5 5 1.5 5 4 0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export default function App() {
  const webcamRef = useRef<Webcam>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [currentSongUrl, setCurrentSongUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [recommendedSong, setRecommendedSong] = useState<{name: string, artist: string} | null>(null);
  
  // Camera permission flow
  const [isCameraRequested, setIsCameraRequested] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  // Platform selection
  const [platform, setPlatform] = useState<Platform>('youtube');

  // Force dark mode for atmospheric UI
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const playSong = (songName: string, artist: string, directUrl: string) => {
    setCurrentSongUrl(directUrl);
    setRecommendedSong({ name: songName, artist });
    setIsRedirecting(true);
    setCountdown(5);

    // Countdown logic
    let currentCount = 5;
    const interval = setInterval(() => {
      currentCount -= 1;
      setCountdown(currentCount);
      if (currentCount <= 0) {
        clearInterval(interval);
        window.location.href = directUrl;
      }
    }, 1000);
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setIsAnalyzing(true);
    setEmotion(null);
    setCurrentSongUrl(null);
    setRecommendedSong(null);
    setIsRedirecting(false);

    try {
      const apiKey = MANUAL_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please add it to MANUAL_GEMINI_API_KEY.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const base64Data = imageSrc.split(',')[1];
      const randomSeed = Math.floor(Math.random() * 1000000);

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg"
            }
          },
          `You are an expert facial expression analyzer. 
          1. Carefully analyze the user's facial expression, micro-expressions, and overall mood in this image.
          2. Classify the emotion strictly as 'HAPPY', 'SAD', or 'NEUTRAL'.
          3. Recommend a Hindi song (old classic Bollywood or new) that perfectly matches this emotion. 
          IMPORTANT: Provide a valid, direct playable URL for this song on the platform: ${platform}. Do not provide a search link.
          For spotify, the URL should look like https://open.spotify.com/track/...
          For youtube, the URL should look like https://www.youtube.com/watch?v=...
          CRITICAL: DO NOT hallucinate or make up video/track IDs. The URL MUST be a real, working link. If you are not 100% sure of the exact real URL, pick a more famous song where you know the exact URL. Return a JSON object.`
        ],
        config: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              emotion: { type: Type.STRING, enum: ["HAPPY", "SAD", "NEUTRAL"] },
              songName: { type: Type.STRING },
              artist: { type: Type.STRING },
              songUrl: { type: Type.STRING }
            },
            required: ["emotion", "songName", "artist", "songUrl"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      if (result.emotion && result.songName && result.songUrl) {
        setEmotion(result.emotion as Emotion);
        playSong(result.songName, result.artist || '', result.songUrl);
      } else {
        throw new Error("Invalid response");
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      // Fallback
      setEmotion('NEUTRAL');
      playSong('Kabira', 'Arijit Singh', 'https://www.youtube.com/watch?v=jHNNMj5bNQw');
    } finally {
      setIsAnalyzing(false);
    }
  }, [platform]);

  const handleManualSelection = async (emo: Emotion) => {
    setIsAnalyzing(true);
    setEmotion(emo);
    setCurrentSongUrl(null);
    setRecommendedSong(null);
    setIsRedirecting(false);

    try {
      const apiKey = MANUAL_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please add it to MANUAL_GEMINI_API_KEY.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const randomSeed = Math.floor(Math.random() * 1000000);
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `I am feeling ${emo}. Recommend a Hindi song (can be old classic Bollywood or new) that perfectly matches this emotion. 
        IMPORTANT: Provide a valid, direct playable URL for this song on the platform: ${platform}. Do not provide a search link.
        For spotify, the URL should look like https://open.spotify.com/track/...
        For youtube, the URL should look like https://www.youtube.com/watch?v=...
        CRITICAL: DO NOT hallucinate or make up video/track IDs. The URL MUST be a real, working link. If you are not 100% sure of the exact real URL, pick a more famous song where you know the exact URL. Return a JSON object.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              songName: { type: Type.STRING },
              artist: { type: Type.STRING },
              songUrl: { type: Type.STRING }
            },
            required: ["songName", "artist", "songUrl"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      if (result.songName && result.songUrl) {
        playSong(result.songName, result.artist || '', result.songUrl);
      } else {
        throw new Error("Invalid response");
      }
    } catch (error) {
      console.error("Error getting song:", error);
      // Fallback
      playSong('Tum Hi Ho', 'Arijit Singh', 'https://www.youtube.com/watch?v=Umqb9KENgmk');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getEmotionConfig = (emo: Emotion | null) => {
    switch (emo) {
      case 'HAPPY':
        return { icon: Smile, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', glow: 'from-amber-500/20 to-orange-500/20', text: 'Joyful & Upbeat' };
      case 'SAD':
        return { icon: Frown, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', glow: 'from-blue-600/20 to-indigo-600/20', text: 'Melancholy & Deep' };
      case 'NEUTRAL':
        return { icon: Meh, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', glow: 'from-emerald-500/20 to-teal-500/20', text: 'Chill & Relaxed' };
      default:
        return { icon: Sparkles, color: 'text-white', bg: 'bg-white/5', border: 'border-white/10', glow: 'from-purple-500/10 to-pink-500/10', text: 'Ready to listen' };
    }
  };

  const config = getEmotionConfig(emotion);
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden relative selection:bg-white/20">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 left-1/4 w-[40rem] h-[40rem] rounded-full blur-[128px] opacity-60 transition-colors duration-1000 bg-gradient-to-br ${config.glow}`} />
        <div className={`absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] rounded-full blur-[100px] opacity-40 transition-colors duration-1000 bg-gradient-to-tl ${config.glow}`} />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 min-h-screen flex flex-col items-center justify-center">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          {/* Animated Wavy Gradient Logo */}
          <div className="relative inline-block mb-4">
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-wave">
              AuraBeats
            </h1>
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-2xl animate-wave -z-10 rounded-full"></div>
          </div>
          <p className="text-lg text-white/50 max-w-md mx-auto font-light tracking-wide">
            Discover the perfect soundtrack for your current state of mind.
          </p>
        </motion.div>

        {/* Platform Selector */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl mb-8 flex flex-col items-center"
        >
          <p className="text-xs uppercase tracking-widest text-white/40 mb-3 font-semibold">Select Music Platform</p>
          <div className="flex flex-wrap items-center justify-center gap-3 p-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
            <button 
              onClick={() => setPlatform('youtube')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all font-medium text-sm ${platform === 'youtube' ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
              <YoutubeIcon className="w-5 h-5" /> YouTube
            </button>
            <button 
              onClick={() => setPlatform('spotify')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all font-medium text-sm ${platform === 'spotify' ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
              <SpotifyIcon className="w-5 h-5" /> Spotify
            </button>
            <button 
              onClick={() => setPlatform('jiosaavn')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all font-medium text-sm ${platform === 'jiosaavn' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
              <JioSaavnIcon className="w-5 h-5" /> JioSaavn
            </button>
          </div>
        </motion.div>

        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Input Methods */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-6"
          >
            {/* Webcam / Scanner Card */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-medium tracking-tight">Aura Scanner</h2>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black/50 min-h-[300px] border border-white/5 flex flex-col items-center justify-center">
                {!isCameraRequested ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center w-full h-full">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6">
                      <Camera className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">Camera Access Required</h3>
                    <p className="text-white/50 text-sm mb-8 max-w-sm">We need your camera to analyze your facial expressions and detect your mood.</p>
                    <button
                      onClick={() => setIsCameraRequested(true)}
                      className="px-8 py-4 rounded-xl bg-white text-black font-bold hover:bg-white/90 transition-colors shadow-lg hover:scale-105 active:scale-95"
                    >
                      Allow Camera Access
                    </button>
                  </div>
                ) : (
                  <>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      screenshotQuality={0.8}
                      videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
                      onUserMedia={() => setHasCameraPermission(true)}
                      onUserMediaError={() => setHasCameraPermission(false)}
                      className="w-full h-full object-cover"
                    />
                    
                    {hasCameraPermission === false && (
                      <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                        <Frown className="w-12 h-12 text-red-400 mb-4" />
                        <p className="text-white font-medium">Camera access denied.</p>
                        <p className="text-white/50 text-sm mt-2">Please enable it in your browser settings and refresh.</p>
                      </div>
                    )}

                    <AnimatePresence>
                      {isAnalyzing && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center"
                        >
                          <Loader2 className="w-10 h-10 text-white animate-spin mb-4" />
                          <p className="text-sm font-medium tracking-widest uppercase text-white/80">Reading Aura...</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>

              <button
                onClick={captureAndAnalyze}
                disabled={isAnalyzing || !isCameraRequested || hasCameraPermission === false || isRedirecting}
                className="mt-6 w-full py-4 rounded-xl bg-white text-black font-semibold tracking-wide hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isAnalyzing ? 'Analyzing...' : 'Scan My Aura'}
              </button>
            </div>

            {/* Manual Selection Card */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl">
              <h2 className="text-sm font-medium tracking-widest uppercase text-white/50 mb-6">Or select manually</h2>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => handleManualSelection('HAPPY')}
                  disabled={isRedirecting}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 hover:bg-amber-400/10 hover:text-amber-400 border border-white/5 hover:border-amber-400/20 transition-all group disabled:opacity-50"
                >
                  <Smile className="w-6 h-6 mb-2 opacity-70 group-hover:opacity-100" />
                  <span className="text-xs font-medium">Happy</span>
                </button>
                <button 
                  onClick={() => handleManualSelection('NEUTRAL')}
                  disabled={isRedirecting}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 hover:bg-emerald-400/10 hover:text-emerald-400 border border-white/5 hover:border-emerald-400/20 transition-all group disabled:opacity-50"
                >
                  <Meh className="w-6 h-6 mb-2 opacity-70 group-hover:opacity-100" />
                  <span className="text-xs font-medium">Chill</span>
                </button>
                <button 
                  onClick={() => handleManualSelection('SAD')}
                  disabled={isRedirecting}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 hover:bg-blue-400/10 hover:text-blue-400 border border-white/5 hover:border-blue-400/20 transition-all group disabled:opacity-50"
                >
                  <Frown className="w-6 h-6 mb-2 opacity-70 group-hover:opacity-100" />
                  <span className="text-xs font-medium">Sad</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Results */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col"
          >
            <div className={`flex-1 p-8 rounded-3xl border backdrop-blur-2xl shadow-2xl transition-all duration-500 flex flex-col items-center justify-center text-center ${config.bg} ${config.border}`}>
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={emotion || 'empty'}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className={`p-6 rounded-full bg-black/20 mb-6 ${config.color}`}>
                    <Icon className="w-16 h-16" />
                  </div>
                  
                  <h3 className="text-2xl font-semibold tracking-tight mb-2">
                    {emotion ? `Aura: ${emotion}` : 'Awaiting Input'}
                  </h3>
                  <p className="text-white/60 mb-8">
                    {config.text}
                  </p>

                  {recommendedSong && (
                    <div className="mb-8 flex flex-col items-center">
                      <p className="text-sm text-white/50 uppercase tracking-widest mb-2">Recommended Track</p>
                      <h4 className="text-xl font-bold text-white">{recommendedSong.name}</h4>
                      <p className="text-white/70">{recommendedSong.artist}</p>
                    </div>
                  )}

                  {currentSongUrl ? (
                    <div className="w-full flex flex-col items-center">
                      
                      {isRedirecting && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-6 flex flex-col items-center text-white/90 bg-white/10 px-6 py-4 rounded-2xl border border-white/20 w-full"
                        >
                          <Loader2 className="w-6 h-6 animate-spin mb-2" />
                          <p className="text-sm uppercase tracking-widest font-bold">Opening {platform} in {countdown}s...</p>
                        </motion.div>
                      )}

                      <a
                        href={currentSongUrl}
                        className={`inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-white text-black font-semibold tracking-wide hover:scale-105 transition-transform shadow-xl w-full sm:w-auto ${isRedirecting ? 'opacity-50' : ''}`}
                      >
                        <Play className="w-5 h-5 fill-current" />
                        Play Song Now
                      </a>
                      <p className="mt-6 text-xs text-white/40 uppercase tracking-widest">
                        If it doesn't open automatically, click above
                      </p>
                    </div>
                  ) : (
                    <div className="w-full max-w-xs h-16 rounded-2xl border border-dashed border-white/20 flex items-center justify-center text-white/30 text-sm">
                      Song will appear here
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
