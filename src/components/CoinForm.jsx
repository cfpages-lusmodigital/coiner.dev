import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload } from 'lucide-react';

const CoinForm = ({ formData, setFormData, handleLaunch, walletConnected }) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'ticker') {
      finalValue = value.toUpperCase();
    }
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const isFormFilled = formData.name && formData.ticker && formData.description && formData.image;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Launch Your Legend</CardTitle>
        <CardDescription>Fill in your coin's details to get started.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Coin Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g., Solana Cat"
            value={formData.name}
            onChange={handleInputChange}
            maxLength="32"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticker">Ticker</Label>
          <Input
            id="ticker"
            name="ticker"
            placeholder="e.g., SCAT"
            value={formData.ticker}
            onChange={handleInputChange}
            maxLength="8"
            required
          />
           <p className="text-xs text-gray-400">3-8 uppercase characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Tell the world about your coin's story."
            value={formData.description}
            onChange={handleInputChange}
            maxLength="280"
            required
          />
        </div>
        <div className="space-y-2">
            <Label>Image / Logo</Label>
            <div className="flex items-center justify-center w-full">
              <label htmlFor="image" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-800">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {formData.image ? (
                    <img src={formData.image} alt="Token Preview" className="w-24 h-24 object-cover rounded-full" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mb-4 text-gray-500" />
                      <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag & drop</p>
                      <p className="text-xs text-gray-500">PNG, JPG, or GIF (400x400px recommended)</p>
                    </>
                  )}
                </div>
                <Input id="image" type="file" className="hidden" onChange={handleImageUpload} accept="image/png, image/jpeg, image/gif" />
              </label>
            </div>
        </div>

        <div className="pt-4 space-y-4">
            <p className="text-center font-semibold">Creation Fee: 0.02 SOL 🪙</p>
            <Button
              onClick={handleLaunch}
              className="w-full text-lg"
              size="lg"
              disabled={!isFormFilled || !walletConnected}
            >
              {!walletConnected
                ? "Connect Wallet to Launch"
                : !isFormFilled
                ? "Fill All Fields to Launch"
                : "Let's Go! 🚀"}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CoinForm;
