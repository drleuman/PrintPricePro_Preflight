import React, { useState, useRef, useEffect } from 'react';
import { BookConfig, QuoteOffer } from '../../types';
import { SafeHtmlMarkdown } from '../SafeHtmlMarkdown';
import {
    ChatBubbleLeftRightIcon,
    PaperAirplaneIcon,
    SparklesIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'summary' | 'offers';
    offers?: QuoteOffer[];
}

interface AssistantChatProps {
    config: BookConfig;
    onSelectOffer: (offer: QuoteOffer) => void;
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
    config,
    onSelectOffer,
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: `Hello! I'm your Print Pricing Assistant. I can help you find the best options for your book project.

### Current Project Summary
- **Format:** ${config.format || 'Not specified'}
- **Quantity:** ${config.quantity} units
- **Cover:** ${config.cover_pages} pages, ${config.pms_cover} PMS color(s)
- **Interior:** ${config.pms_interior} PMS color(s)

Would you like me to generate some pricing offers based on these specs?`,
            type: 'text'
        }
    ]);

    // Notify assistant of config changes
    useEffect(() => {
        if (messages.length > 1) { // Don't trigger on initial load
            const updateMsg: Message = {
                role: 'assistant',
                content: `I've updated your project summary with the latest changes:
        
- **Quantity:** ${config.quantity} units
- **Cover:** ${config.cover_pages} pages
- **PMS (C/I):** ${config.pms_cover} / ${config.pms_interior}

How would you like to proceed?`,
                type: 'text'
            };
            setMessages(prev => [...prev, updateMsg]);
        }
    }, [config.quantity, config.cover_pages, config.pms_cover, config.pms_interior]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        processAIResponse(input);
    };

    const processAIResponse = (userText: string) => {
        setIsTyping(true);

        // Simulate AI logic
        setTimeout(() => {
            setIsTyping(false);
            let aiMsg: Message;

            if (userText.toLowerCase().includes('offer') || userText.toLowerCase().includes('price') || userText.toLowerCase().includes('yes')) {
                aiMsg = {
                    role: 'assistant',
                    content: "Based on your project, here are the best offers I've found:",
                    type: 'offers',
                    offers: [
                        { id: '1', title: 'Standard Quality', price: '$1,250', description: 'Offset printing, 80lb paper, 10-day delivery.' },
                        { id: '2', title: 'Premium Print', price: '$1,580', description: 'High-end coated paper, specialty inks, 7-day delivery.' },
                        { id: '3', title: 'Economy Batch', price: '$980', description: 'Digital printing, standard 60lb paper, 14-day delivery.' },
                    ]
                };
            } else {
                aiMsg = {
                    role: 'assistant',
                    content: "I can help you with pricing, paper selection, or technical advice for your print project. What's on your mind?",
                    type: 'text'
                };
            }

            setMessages(prev => [...prev, aiMsg]);
        }, 1500);
    };

    const choiceBubbles = [
        "Generate Offers",
        "Suggested Papers",
        "Check Technical Specs",
        "Contact Support"
    ];

    return (
        <div className="flex flex-col h-[600px] bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">Price Assistant</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-xs text-gray-500 font-medium">Online & Ready</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
            >
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                            }`}>
                            <SafeHtmlMarkdown markdown={msg.content} />

                            {msg.type === 'offers' && msg.offers && (
                                <div className="mt-4 grid grid-cols-1 gap-3">
                                    {msg.offers.map(offer => (
                                        <button
                                            key={offer.id}
                                            onClick={() => onSelectOffer(offer)}
                                            className="text-left p-4 rounded-xl border-2 border-blue-50 border-transparent hover:border-blue-500 hover:bg-blue-50 transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-gray-900 group-hover:text-blue-700">{offer.title}</span>
                                                <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-sm font-bold">{offer.price}</span>
                                            </div>
                                            <p className="text-sm text-gray-500">{offer.description}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex gap-1">
                            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Choice Bubbles */}
            <div className="px-6 py-3 bg-gray-50 flex gap-2 overflow-x-auto no-scrollbar">
                {choiceBubbles.map(choice => (
                    <button
                        key={choice}
                        onClick={() => {
                            setInput(choice);
                            // Small delay for UX
                            setTimeout(() => {
                                const userMsg: Message = { role: 'user', content: choice };
                                setMessages(prev => [...prev, userMsg]);
                                setInput('');
                                processAIResponse(choice);
                            }, 100);
                        }}
                        className="whitespace-nowrap px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                    >
                        {choice}
                    </button>
                ))}
            </div>

            {/* Input area */}
            <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200"
                    >
                        <PaperAirplaneIcon className="w-5 h-5 -rotate-45" />
                    </button>
                </div>
            </div>
        </div>
    );
};
