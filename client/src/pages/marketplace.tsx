import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabaseData";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Search, Star, Truck, ShoppingCart, BookOpen, Tag, Package } from "lucide-react";

const CATEGORIES = [
  { value: "tous", label: "Tous" },
  { value: "sanitaire", label: "Sanitaire" },
  { value: "chauffage", label: "Chauffage" },
  { value: "tuyauterie", label: "Tuyauterie" },
  { value: "outillage", label: "Outillage" },
  { value: "EPI", label: "EPI" },
] as const;

const SORT_OPTIONS = [
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "rating", label: "Meilleures notes" },
  { value: "delivery", label: "Livraison rapide" },
] as const;

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`size-3 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-0.5">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("tous");
  const [sort, setSort] = useState("rating");
  const { toast } = useToast();

  const { data: items = [] } = useQuery<any[]>({
    queryKey: ["marketplace"],
    queryFn: () => db.getMarketplaceItems(),
  });

  const filtered = useMemo(() => {
    let list = [...items];

    if (category !== "tous") {
      list = list.filter(i => i.category === category);
    }
    if (search) {
      const term = search.toLowerCase();
      list = list.filter(i =>
        i.name.toLowerCase().includes(term) ||
        (i.supplier_name || "").toLowerCase().includes(term) ||
        (i.description || "").toLowerCase().includes(term)
      );
    }

    switch (sort) {
      case "price_asc":
        list.sort((a, b) => parseFloat(a.price_ht || "0") - parseFloat(b.price_ht || "0"));
        break;
      case "price_desc":
        list.sort((a, b) => parseFloat(b.price_ht || "0") - parseFloat(a.price_ht || "0"));
        break;
      case "rating":
        list.sort((a, b) => parseFloat(b.rating || "0") - parseFloat(a.rating || "0"));
        break;
      case "delivery":
        list.sort((a, b) => (a.delivery_days || 99) - (b.delivery_days || 99));
        break;
    }

    return list;
  }, [items, category, search, sort]);

  const promoCount = items.filter(i => i.promo_percent && parseFloat(String(i.promo_percent)) > 0).length;

  return (
    <AppLayout title="Marketplace fournisseurs">
      {/* Hero banner */}
      <div className="rounded-lg bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border border-primary/20 p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Package className="size-5 text-primary" />
              Marketplace Fournisseurs
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Commandez vos fournitures au meilleur prix directement depuis PlombPro
            </p>
          </div>
          <div className="flex gap-3">
            <Card><CardContent className="py-2 px-3 text-center"><div className="text-xs text-muted-foreground">Produits</div><div className="text-base font-bold">{items.length}</div></CardContent></Card>
            <Card><CardContent className="py-2 px-3 text-center"><div className="text-xs text-muted-foreground">Promos</div><div className="text-base font-bold text-amber-400">{promoCount}</div></CardContent></Card>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit ou fournisseur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            data-testid="marketplace-search"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {CATEGORIES.map(c => (
            <Button
              key={c.value}
              variant={category === c.value ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setCategory(c.value)}
              data-testid={`filter-${c.value}`}
            >
              {c.label}
            </Button>
          ))}
        </div>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="sort-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(item => {
          const promo = item.promo_percent ? parseFloat(String(item.promo_percent)) : 0;
          const price = parseFloat(item.price_ht || "0");
          const discountedPrice = promo > 0 ? price * (1 - promo / 100) : price;
          const rating = parseFloat(item.rating || "0");

          return (
            <Card key={item.id} className="relative overflow-hidden hover:border-primary/30 transition-colors" data-testid={`product-card-${item.id}`}>
              {promo > 0 && (
                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-red-500/90 text-white border-0 text-[10px] gap-1">
                    <Tag className="size-2.5" /> -{promo}%
                  </Badge>
                </div>
              )}

              <CardContent className="py-4 px-4 space-y-3">
                {/* Supplier badge */}
                <Badge variant="outline" className="text-[10px] font-medium">
                  {item.supplier_name}
                </Badge>

                {/* Product name */}
                <div>
                  <h3 className="text-sm font-semibold leading-tight">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                </div>

                {/* Rating */}
                <StarRating rating={rating} />

                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold tabular-nums lining-nums">
                    {formatCurrency(discountedPrice)}
                  </span>
                  {promo > 0 && (
                    <span className="text-xs text-muted-foreground line-through tabular-nums lining-nums">
                      {formatCurrency(price)}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">HT / {item.unit}</span>
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Truck className="size-3" />
                    {item.delivery_days} jour{(item.delivery_days || 0) > 1 ? "s" : ""}
                  </span>
                  {item.in_stock ? (
                    <Badge variant="outline" className="text-[10px] border-0 bg-emerald-500/15 text-emerald-400">
                      En stock
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-0 bg-red-500/15 text-red-400">
                      Rupture
                    </Badge>
                  )}
                  {item.min_quantity && item.min_quantity > 1 && (
                    <span>Min. {item.min_quantity}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="gap-2 h-8 text-xs flex-1"
                    disabled={!item.in_stock}
                    onClick={() => toast({ title: "Commande simulée", description: `${item.name} ajouté au panier` })}
                    data-testid={`order-btn-${item.id}`}
                  >
                    <ShoppingCart className="size-3.5" /> Commander
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-8 text-xs"
                    onClick={() => toast({ title: "Ajouté à la bibliothèque", description: item.name })}
                    data-testid={`library-btn-${item.id}`}
                  >
                    <BookOpen className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun produit trouvé</p>
        </div>
      )}
    </AppLayout>
  );
}
