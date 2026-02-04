import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditResource: (
    id: string,
    title: string,
    description: string,
    resourceType: string,
    resourceUrl: string,
  ) => Promise<void>;
  resource: {
    id: string;
    title: string;
    description: string;
    resource_type: string;
    resource_url: string;
  } | null;
}

export function EditResourceDialog({ open, onOpenChange, onEditResource, resource }: EditResourceDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState("link");
  const [resourceUrl, setResourceUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resource) {
      setTitle(resource.title);
      setDescription(resource.description || "");
      setResourceType(resource.resource_type);
      setResourceUrl(resource.resource_url);
    }
  }, [resource]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resource) return;

    setLoading(true);
    try {
      await onEditResource(resource.id, title, description, resourceType, resourceUrl);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kaynağı Düzenle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Başlık</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kaynak başlığı"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kaynak açıklaması (opsiyonel)"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="resourceType">Kaynak Türü</Label>
            <Select value={resourceType} onValueChange={setResourceType}>
              <SelectTrigger>
                <SelectValue placeholder="Kaynak türünü seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="document">Doküman</SelectItem>
                <SelectItem value="link">Link</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="resourceUrl">Kaynak URL</Label>
            <Input
              id="resourceUrl"
              type="url"
              value={resourceUrl}
              onChange={(e) => setResourceUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
