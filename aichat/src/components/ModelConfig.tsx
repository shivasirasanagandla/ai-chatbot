import React, { useState, useEffect } from 'react';
import { ModelConfig as ModelConfigType } from '../types';
import { Settings, Save } from 'lucide-react';

interface ModelConfigProps {
  config: ModelConfigType | null;
  onUpdateConfig: (config: Partial<ModelConfigType>) => void;
}

const ModelConfig: React.FC<ModelConfigProps> = ({ config, onUpdateConfig }) => {
  const [localConfig, setLocalConfig] = useState<ModelConfigType>({
    temperature: 0.7,
    max_tokens: 1000,
    model: 'gpt-3.5-turbo'
  });

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleSave = () => {
    onUpdateConfig(localConfig);
  };

  const handleReset = () => {
    const defaultConfig = {
      temperature: 0.7,
      max_tokens: 1000,
      model: 'gpt-3.5-turbo'
    };
    setLocalConfig(defaultConfig);
    onUpdateConfig(defaultConfig);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <Settings className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Model Configuration</h2>
          <p className="text-gray-600">Adjust AI model parameters</p>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature: {localConfig.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localConfig.temperature}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                temperature: parseFloat(e.target.value)
              })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Conservative (0)</span>
              <span>Balanced (1)</span>
              <span>Creative (2)</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Controls randomness in responses. Higher values make output more creative but less predictable.
            </p>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Tokens: {localConfig.max_tokens}
            </label>
            <input
              type="range"
              min="100"
              max="4000"
              step="100"
              value={localConfig.max_tokens}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                max_tokens: parseInt(e.target.value)
              })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Short (100)</span>
              <span>Medium (2000)</span>
              <span>Long (4000)</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Maximum length of the response. Higher values allow for longer responses but cost more.
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model
            </label>
            <select
              value={localConfig.model}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                model: e.target.value
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
            </select>
            <p className="text-sm text-gray-600 mt-2">
              Select the AI model to use. GPT-4 models are more capable but slower and more expensive.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Save size={16} />
              <span>Save Configuration</span>
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>

      {/* Current Configuration Display */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Temperature</p>
            <p className="text-2xl font-bold text-blue-600">{localConfig.temperature}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Max Tokens</p>
            <p className="text-2xl font-bold text-green-600">{localConfig.max_tokens}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Model</p>
            <p className="text-sm font-bold text-purple-600">{localConfig.model}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelConfig;