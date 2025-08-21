import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AIPersonaDialog } from "@/components/AIPersonaDialog";
import { Bot, Settings, UserPlus, Brain } from "lucide-react";

export const AIManagement = () => {
  const [showPersonaDialog, setShowPersonaDialog] = useState(false);

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Management</h1>
          <p className="text-muted-foreground">
            Configure your AI assistant persona and conversation settings
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          AI System
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* AI Persona Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Persona
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure your AI character's personality, background, and conversation style.
            </p>
            <Button 
              onClick={() => setShowPersonaDialog(true)}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure Persona
            </Button>
          </CardContent>
        </Card>

        {/* Conversation Modes Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              Conversation Modes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Badge variant="secondary">Friendly Chat</Badge>
              <Badge variant="secondary">Supportive Nudges</Badge>
              <Badge variant="secondary">Comeback Mode</Badge>
              <Badge variant="secondary">Intimate Flirt</Badge>
              <Badge variant="secondary">AutoPilot</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Different conversation styles for various fan interactions.
            </p>
          </CardContent>
        </Card>

        {/* Fan Memory Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-500" />
              Fan Memory System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AI remembers individual fan preferences, history, and conversations for personalized interactions.
            </p>
            <p className="text-xs text-muted-foreground">
              Manage fan notes in individual conversations
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Features Card */}
        <Card>
          <CardHeader>
            <CardTitle>AI Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Typing Simulation</span>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Jailbreak Protection</span>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Character Consistency</span>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Memory System</span>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Guidelines Card */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <p>• Configure your persona before enabling AI responses</p>
              <p>• Add fan notes for better personalization</p>
              <p>• Use different modes for different fan types</p>
              <p>• Monitor conversations for quality assurance</p>
              <p>• The AI maintains character consistency automatically</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Persona Dialog */}
      <AIPersonaDialog 
        open={showPersonaDialog} 
        onOpenChange={setShowPersonaDialog} 
      />
    </div>
  );
};