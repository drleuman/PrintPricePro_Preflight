import React from 'react';
import { COVER_PAGES_OPTIONS, PMS_OPTIONS, COVER_PRINT_REV_OPTIONS } from '../../constants';
import { BookConfig } from '../../types';

interface BookPriceFormProps {
    config: BookConfig;
    onChange: (config: BookConfig) => void;
}

export const BookPriceForm: React.FC<BookPriceFormProps> = ({
    config,
    onChange,
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        onChange({
            ...config,
            [name]: name === 'quantity' || name.includes('pages') || name.includes('pms') || name.includes('rev')
                ? parseInt(value, 10)
                : value,
        });
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-6">
            <h3 className="text-xl font-bold text-gray-900 border-b pb-4">Project Specifications</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity</label>
                        <input
                            type="number"
                            name="quantity"
                            value={config.quantity}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all font-bold"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Interior Pages</label>
                        <input
                            type="number"
                            name="pages_interior"
                            value={config.pages_interior}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all font-bold"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Format / Size</label>
                        <input
                            type="text"
                            name="format"
                            value={config.format}
                            onChange={handleChange}
                            placeholder="e.g. A5, 6x9 in"
                            className="w-full px-4 py-2 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Technical Specs */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Cover Pages</label>
                        <select
                            name="cover_pages"
                            value={config.cover_pages}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50"
                        >
                            {COVER_PAGES_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt} Pages</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">PMS Interior</label>
                            <select
                                name="pms_interior"
                                value={config.pms_interior}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50"
                            >
                                <option value={0}>None</option>
                                {PMS_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt} Color(s)</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">PMS Cover</label>
                            <select
                                name="pms_cover"
                                value={config.pms_cover}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50"
                            >
                                <option value={0}>None</option>
                                {PMS_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt} Color(s)</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Cover Print Revisions</label>
                        <select
                            name="cover_print_rev"
                            value={config.cover_print_rev}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50"
                        >
                            {COVER_PRINT_REV_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt} Rev.</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="pt-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 italic text-sm text-blue-800">
                    Tip: Accurate specifications help our AI assistant provide better options and pricing.
                </div>
            </div>
        </div>
    );
};
