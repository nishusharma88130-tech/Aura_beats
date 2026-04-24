import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Loader2, Smile, Frown, Meh, Music, Play, Sparkles, Video, Info, History, X, Trash2, ListMusic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import * as faceapi from '@vladmandic/face-api';

type Emotion = 'HAPPY' | 'SAD' | 'NEUTRAL';
type Platform = 'youtube' | 'spotify' | 'jiosaavn';

type Song = {
  songName: string;
  artist: string;
  songUrl: string;
};

type HistoryEntry = {
  id: string;
  emotion: Emotion;
  playlist: Song[];
  timestamp: number;
};

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
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm2.83 16.28c-1.5 1.04-3.86 1.2-5.66.16a.87.87 0 1 1 .86-1.5c1.28.74 2.96.63 4.02-.1.95-.66.95-1.74 0-2.4-1.1-.76-3.15-1.18-4.25-1.94-1.9-1.32-1.9-3.46 0-4.78 1.5-1.04 3.86-1.2 5.66-.16a.87.87 0 1 1-.86 1.5c-1.28-.74-2.96-.63-4.02.1-.95.66-.95 1.74 0 2.4 1.1.76 3.15 1.18 4.25 1.94 1.9 1.32 1.9 3.46 0 4.78z"/>
  </svg>
);

export default function App() {
  const webcamRef = useRef<Webcam>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [currentSongUrl, setCurrentSongUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [recommendedPlaylist, setRecommendedPlaylist] = useState<Song[] | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Modals & History
  const [showInfo, setShowInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Camera permission flow
  const [isCameraRequested, setIsCameraRequested] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  // Platform selection
  const [platform, setPlatform] = useState<Platform>('youtube');

  // Face API models state
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);

  // Force dark mode for atmospheric UI
  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    // Load face-api models
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        setIsModelsLoaded(true);
      } catch (error) {
        console.error("Error loading face-api models:", error);
      }
    };
    loadModels();

    // Load history from local storage
    const savedHistory = localStorage.getItem('emotionPlayerHistory') || localStorage.getItem('auraBeatsHistory'); // Fallback for migration
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
        if (!localStorage.getItem('emotionPlayerHistory')) {
             localStorage.setItem('emotionPlayerHistory', savedHistory);
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const addToHistory = (emo: Emotion, playlist: Song[]) => {
    const newEntry: HistoryEntry = {
      id: Date.now().toString(),
      emotion: emo,
      playlist,
      timestamp: Date.now()
    };
    const updatedHistory = [newEntry, ...history].slice(0, 20); // Keep last 20
    setHistory(updatedHistory);
    localStorage.setItem('emotionPlayerHistory', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('emotionPlayerHistory');
    localStorage.removeItem('auraBeatsHistory'); // Clear legacy key too
  };

  const playSong = (playlist: Song[]) => {
    if (!playlist || playlist.length === 0) return;
    
    const topSong = playlist[0];
    setCurrentSongUrl(topSong.songUrl);
    setRecommendedPlaylist(playlist);
    setIsRedirecting(true);
    setCountdown(3);

    // Countdown logic
    let currentCount = 3;
    const interval = setInterval(() => {
      currentCount -= 1;
      setCountdown(currentCount);
      if (currentCount <= 0) {
        clearInterval(interval);
        
        // Check if user is on a mobile device (tablet or smartphone)
        const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobileOrTablet) {
          // On mobile devices, assigning to window.location.href naturally prompts 
          // the OS to check if a corresponding Native App is installed (YouTube, Spotify, etc.)
          // due to the platforms' Universal/App Links configuration.
          window.location.href = topSong.songUrl;
        } else {
          // On Desktop/Laptop PC, we want to open in a new tab so they don't lose the web app
          window.open(topSong.songUrl, '_blank');
          
          // Since we opened a new tab, the user stays on our page, so we reset the redirecting state
          // after a slight delay, allowing them to scan again without refreshing.
          setTimeout(() => {
             setIsRedirecting(false);
          }, 1000);
        }
      }
    }, 1000);
  };

  const fetchSongsForEmotion = async (emo: Emotion) => {
    const getApiKey = () => {
      if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
      try {
        if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
      } catch (e) {
        // ignore
      }
      return null;
    };
    
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("API Key is missing. For local testing, add VITE_GEMINI_API_KEY to your .env file. For GitHub Pages, add VITE_GEMINI_API_KEY to your GitHub repository's Actions Secrets.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const decades = ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
    const randomDecade = decades[Math.floor(Math.random() * decades.length)];
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `I am feeling ${emo}. Recommend a UNIQUE Mini Playlist of exactly 3 Hindi songs (from the ${randomDecade}) that match this emotion.
      - If HAPPY: Recommend upbeat, energetic, joyful, or dance Hindi music.
      - If SAD: Recommend melancholic, emotional, slow, or heartbreak Hindi music.
      - If NEUTRAL: Recommend chill, normal, relaxing, or easy-listening Hindi music.
      
      Return ONLY the song name and artist. Do NOT generate URLs.`,
      config: {
        temperature: 0.9,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            playlist: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  songName: { type: Type.STRING },
                  artist: { type: Type.STRING }
                },
                required: ["songName", "artist"]
              }
            }
          },
          required: ["playlist"]
        }
      }
    });

    const text = response.text || "";
    const result = JSON.parse(text);
    
    if (result.playlist && result.playlist.length > 0) {
      // Use Google's "I'm Feeling Lucky" (btnI=1) to automatically redirect to the first real search result
      // This completely prevents AI hallucinations (fake links) while providing a direct link instead of a search page.
      const formattedPlaylist = result.playlist.map((song: any) => {
        let siteFilter = '';
        if (platform === 'spotify') siteFilter = 'site:open.spotify.com/track';
        else if (platform === 'jiosaavn') siteFilter = 'site:jiosaavn.com/song';
        else siteFilter = 'site:youtube.com';
        
        const searchQuery = `${siteFilter} ${song.songName} ${song.artist}`;
        const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&btnI=1`;
        
        return { ...song, songUrl: url };
      });

      addToHistory(emo, formattedPlaylist);
      playSong(formattedPlaylist);
    } else {
      throw new Error("Invalid response from AI");
    }
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setCapturedImage(imageSrc);
    setIsAnalyzing(true);
    setEmotion(null);
    setCurrentSongUrl(null);
    setRecommendedPlaylist(null);
    setIsRedirecting(false);
    setErrorMessage(null);

    try {
      if (!isModelsLoaded) {
        throw new Error("Emotion detection models are still loading. Please wait a moment and try again.");
      }

      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve) => { img.onload = resolve; });

      // Use a smaller inputSize for extreme speed (128 instead of 224), and low scoreThreshold
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.1 });
      const detections = await faceapi.detectSingleFace(img, options).withFaceExpressions();

      if (!detections) {
        setErrorMessage("Face not detected. Please make sure your face is clearly visible and well-lit.");
        setCapturedImage(null);
        setIsAnalyzing(false);
        return;
      }

      const expressions = detections.expressions;
      let maxEmotion = '';
      let maxValue = 0;
      for (const [emo, val] of Object.entries(expressions)) {
        if (val > maxValue) {
          maxValue = val;
          maxEmotion = emo;
        }
      }

      let detectedEmo: Emotion = 'NEUTRAL';
      if (maxEmotion === 'happy') detectedEmo = 'HAPPY';
      else if (maxEmotion === 'sad' || maxEmotion === 'angry' || maxEmotion === 'fearful' || maxEmotion === 'disgusted') detectedEmo = 'SAD';
      else detectedEmo = 'NEUTRAL';

      setEmotion(detectedEmo);
      await fetchSongsForEmotion(detectedEmo);
    } catch (error: any) {
      console.error("Error analyzing image:", error);
      const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      setErrorMessage(`Error: ${errorMsg}`);
      setCapturedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isModelsLoaded, platform]);

  const handleManualSelection = async (emo: Emotion) => {
    setIsAnalyzing(true);
    setEmotion(emo);
    setCurrentSongUrl(null);
    setRecommendedPlaylist(null);
    setIsRedirecting(false);
    setErrorMessage(null);
    setCapturedImage(null);

    try {
      await fetchSongsForEmotion(emo);
    } catch (error: any) {
      console.error("Error getting song:", error);
      const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      setErrorMessage(`Error: ${errorMsg}`);
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

  // Dynamic Theme Components
  const DynamicBackground = ({ emotion }: { emotion: Emotion | null }) => {
    if (emotion === 'HAPPY') {
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="sun-ray"></div>
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-yellow-400 rounded-full blur-[1px]"
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: window.innerHeight + 100,
                opacity: Math.random() * 0.5 + 0.3
              }}
              animate={{ 
                y: -100,
                x: `calc(${Math.random() * window.innerWidth}px + ${Math.sin(i) * 100}px)`
              }}
              transition={{ 
                duration: Math.random() * 5 + 5, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            />
          ))}
        </div>
      );
    }
    if (emotion === 'SAD') {
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {Array.from({ length: 50 }).map((_, i) => (
            <div 
              key={i} 
              className="rain-drop" 
              style={{ 
                left: `${Math.random() * 100}vw`, 
                animationDuration: `${Math.random() * 0.5 + 0.5}s`,
                animationDelay: `${Math.random() * 2}s`
              }} 
            />
          ))}
        </div>
      );
    }
    if (emotion === 'NEUTRAL') {
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div 
              key={i} 
              className="cloud" 
              style={{ 
                top: `${Math.random() * 80}vh`, 
                animationDuration: `${Math.random() * 40 + 40}s`,
                animationDelay: `${Math.random() * -40}s`
              }} 
            />
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden relative selection:bg-white/20">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 left-1/4 w-[40rem] h-[40rem] rounded-full blur-[128px] opacity-60 transition-colors duration-1000 bg-gradient-to-br ${config.glow}`} />
        <div className={`absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] rounded-full blur-[100px] opacity-40 transition-colors duration-1000 bg-gradient-to-tl ${config.glow}`} />
      </div>
      
      <DynamicBackground emotion={emotion} />

      {/* Top Navigation */}
      <div className="absolute top-4 right-4 flex gap-3 z-50">
        <button 
          onClick={() => setShowHistory(true)}
          className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-md shadow-xl"
          title="Recent Scans"
        >
          <History className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setShowInfo(true)}
          className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-md shadow-xl"
          title="About Emotion Player"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-16 min-h-screen flex flex-col items-center justify-center">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 md:mb-12 mt-12 md:mt-0"
        >
          {/* Animated Wavy Gradient Logo */}
          <div className="relative inline-block mb-2 md:mb-4">
            <h1 className="pb-2 md:pb-4 text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-wave">
              Emotion Player
            </h1>
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-2xl animate-wave -z-10 rounded-full"></div>
          </div>
          <p className="text-base sm:text-lg text-white/50 max-w-md mx-auto font-light tracking-wide px-4">
            Discover the perfect soundtrack for your current state of mind.
          </p>
        </motion.div>

        {/* Platform Selector */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl mb-6 md:mb-8 flex flex-col items-center"
        >
          <p className="text-[10px] sm:text-xs uppercase tracking-widest text-white/40 mb-2 sm:mb-3 font-semibold">Select Music Platform</p>
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md relative">
            {(['youtube', 'spotify', 'jiosaavn'] as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-full transition-colors font-medium text-xs sm:text-sm outline-none ${platform === p ? (p === 'youtube' ? 'text-red-400' : p === 'spotify' ? 'text-green-400' : 'text-teal-400') : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              >
                {platform === p && (
                  <motion.div
                    layoutId="platform-pill"
                    className={`absolute inset-0 rounded-full border shadow-lg ${p === 'youtube' ? 'bg-red-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : p === 'spotify' ? 'bg-green-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-teal-500/20 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.2)]'}`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {p === 'youtube' && <YoutubeIcon className="w-5 h-5" />}
                  {p === 'spotify' && <SpotifyIcon className="w-5 h-5" />}
                  {p === 'jiosaavn' && <JioSaavnIcon className="w-5 h-5" />}
                  <span className="capitalize">{p}</span>
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          
          {/* Left Column: Input Methods */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-4 md:gap-6"
          >
            {/* Webcam / Scanner Card */}
            <div className="p-4 sm:p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl flex flex-col">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-lg md:text-xl font-medium tracking-tight">Emotion Scanner</h2>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black/50 min-h-[250px] sm:min-h-[300px] border border-white/5 flex flex-col items-center justify-center">
                
                {errorMessage && (
                  <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-xl text-sm font-medium text-center shadow-lg backdrop-blur-md z-20 animate-in fade-in slide-in-from-top-2">
                    {errorMessage}
                  </div>
                )}

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
                    {capturedImage && isAnalyzing ? (
                      <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                    ) : (
                      <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        screenshotQuality={0.7}
                        videoConstraints={{ facingMode: 'user', width: 320, height: 240 }}
                        onUserMedia={() => setHasCameraPermission(true)}
                        onUserMediaError={() => setHasCameraPermission(false)}
                        className="w-full h-full object-cover"
                      />
                    )}
                    
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
                          <p className="text-sm font-medium tracking-widest uppercase text-white/80">Reading Emotion...</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>

              <button
                onClick={captureAndAnalyze}
                disabled={isAnalyzing || !isCameraRequested || hasCameraPermission === false || isRedirecting || !isModelsLoaded}
                className="mt-6 w-full py-4 rounded-xl bg-white text-black font-semibold tracking-wide hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {!isModelsLoaded ? 'Loading AI Models...' : isAnalyzing ? 'Analyzing...' : 'Scan My Emotion'}
              </button>
            </div>

            {/* Manual Selection Card */}
            <div className="p-4 sm:p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl">
              <h2 className="text-xs sm:text-sm font-medium tracking-widest uppercase text-white/50 mb-4 sm:mb-6">Or select manually</h2>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button 
                  onClick={() => handleManualSelection('HAPPY')}
                  disabled={isRedirecting}
                  className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-white/5 hover:bg-amber-400/10 hover:text-amber-400 border border-white/5 hover:border-amber-400/20 transition-all group disabled:opacity-50"
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
            className="flex flex-col h-full"
          >
            <div className={`flex-1 p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl shadow-2xl transition-all duration-500 flex flex-col items-center justify-center text-center ${config.bg} ${config.border}`}>
              
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
                    {emotion ? `Emotion: ${emotion}` : 'Awaiting Input'}
                  </h3>
                  <p className="text-white/60 mb-8">
                    {config.text}
                  </p>

                  {recommendedPlaylist && recommendedPlaylist.length > 0 && (
                    <div className="mb-8 flex flex-col items-center w-full">
                      <p className="text-sm text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ListMusic className="w-4 h-4" /> Mini Playlist
                      </p>
                      
                      {/* Top Track */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full mb-4 flex flex-col items-center text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-white/50 to-transparent"></div>
                        <span className="text-xs font-bold text-white/30 uppercase tracking-widest mb-1">Top Match</span>
                        <h4 className="text-xl font-bold text-white">{recommendedPlaylist[0].songName}</h4>
                        <p className="text-white/70 text-sm mb-4">{recommendedPlaylist[0].artist}</p>
                        
                        {isRedirecting ? (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center text-white/90 bg-white/10 px-6 py-3 rounded-xl border border-white/20 w-full"
                          >
                            <Loader2 className="w-5 h-5 animate-spin mb-1" />
                            <p className="text-xs uppercase tracking-widest font-bold">Opening in {countdown}s...</p>
                          </motion.div>
                        ) : (
                          <a
                            href={recommendedPlaylist[0].songUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:scale-105 transition-transform w-full"
                          >
                            <Play className="w-4 h-4 fill-current" /> Play Now
                          </a>
                        )}
                      </div>

                      {/* Other Tracks */}
                      {recommendedPlaylist.length > 1 && (
                        <div className="w-full flex flex-col gap-2">
                          <span className="text-xs font-medium text-white/40 uppercase tracking-widest self-start ml-2 mb-1">Also Recommended</span>
                          {recommendedPlaylist.slice(1).map((song, idx) => (
                            <a 
                              key={idx}
                              href={song.songUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
                            >
                              <div className="flex flex-col text-left overflow-hidden pr-4">
                                <span className="font-medium text-sm text-white/90 truncate">{song.songName}</span>
                                <span className="text-xs text-white/50 truncate">{song.artist}</span>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors shrink-0">
                                <Play className="w-3 h-3 fill-current" />
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!currentSongUrl && (
                    <div className="w-full max-w-xs h-16 rounded-2xl border border-dashed border-white/20 flex items-center justify-center text-white/30 text-sm">
                      Playlist will appear here
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

            </div>
          </motion.div>

        </div>

        {/* Footer */}
        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center text-white/40 text-sm font-medium tracking-widest uppercase"
        >
          <button 
            onClick={() => setShowInfo(true)}
            className="hover:text-white transition-colors"
          >
            Designed By Nishu😎
          </button>
        </motion.footer>
      </div>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#111] border border-white/10 p-8 rounded-3xl max-w-lg w-full relative shadow-2xl"
            >
              <button 
                onClick={() => setShowInfo(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6">
                <Info className="w-6 h-6 text-indigo-400" />
              </div>
              
              <h2 className="text-2xl font-bold mb-2">About Emotion Player</h2>
              <p className="text-indigo-400 font-medium mb-6">MCA Final Year Project</p>
              
              <div className="space-y-4 text-white/70 text-sm leading-relaxed">
                <p>
                  Created by <strong className="text-white">Nisha Sharma (Nishu)</strong>, Emotion Player explores the intersection of artificial intelligence, facial emotion recognition, and music therapy.
                </p>
                <p>
                  By analyzing micro-expressions in real-time using advanced AI models, the system maps human emotions to curated musical frequencies and genres. It generates personalized mini-playlists designed to resonate perfectly with your current state of mind.
                </p>
                <p>
                  Whether you need an upbeat track to match your joy, or a melancholic melody to accompany a rainy day, Emotion Player provides a seamless, emotionally-aware auditory experience.
                </p>
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                <span className="text-xs text-white/40 uppercase tracking-widest">Version 2.0</span>
                <span className="text-xs text-white/40 uppercase tracking-widest">© 2026</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-[#0a0a0a] border-l border-white/10 w-full max-w-md h-full overflow-y-auto flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-white/70" />
                  <h2 className="text-lg font-bold">Recent Scans</h2>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex-1">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/30 text-center">
                    <History className="w-12 h-12 mb-4 opacity-20" />
                    <p>No history yet.</p>
                    <p className="text-sm mt-2">Scan your emotion to see past playlists here.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-end">
                      <button 
                        onClick={clearHistory}
                        className="flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-3 h-3" /> Clear History
                      </button>
                    </div>
                    
                    {history.map((entry) => (
                      <div key={entry.id} className="bg-white/5 border border-white/5 rounded-2xl p-4">
                        <div className="flex justify-between items-center mb-4">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 ${
                            entry.emotion === 'HAPPY' ? 'text-amber-400' : 
                            entry.emotion === 'SAD' ? 'text-blue-400' : 'text-emerald-400'
                          }`}>
                            {entry.emotion}
                          </span>
                          <span className="text-xs text-white/40">
                            {new Date(entry.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {entry.playlist.map((song, idx) => (
                            <a 
                              key={idx}
                              href={song.songUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                            >
                              <div className="flex flex-col overflow-hidden pr-2">
                                <span className="text-sm font-medium text-white/90 truncate">{song.songName}</span>
                                <span className="text-xs text-white/50 truncate">{song.artist}</span>
                              </div>
                              <Play className="w-3 h-3 text-white/30 group-hover:text-white transition-colors shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
